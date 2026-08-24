# tests/helpers/pb_bootstrap.py
# Bootstrap a fresh PocketBase instance for tests:
#   1. superuser auth
#   2. create demo tenant
#   3. create app_users (admin/compliance/store_manager/employee) + data scopes
#   4. create region/store/employee/device/binding base records
# Returns: dict with base URLs, tokens, ids.
#
# Usage:
#   import sys; sys.path.insert(0, "tests/helpers")
#   from pb_bootstrap import bootstrap
#   env = bootstrap(base="http://127.0.0.1:18140", admin_email="admin@demo.local",
#                   admin_password="admin123456", service_token="svc-token-123")
import json
import random
import string
import urllib.error
import urllib.parse
import urllib.request


def rand_token_key(n=40):
    return "".join(random.choice(string.ascii_letters + string.digits) for _ in range(n))


def req(method, url, body=None, headers=None, timeout=20):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        r.add_header(k, v)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}
    except Exception as e:
        return -1, {"error": str(e)}


class PB:
    def __init__(self, base, superuser_token=None, service_token=None, user_token=None):
        self.base = base
        self.superuser_token = superuser_token
        self.service_token = service_token
        self.user_token = user_token

    def api(self, method, path, body=None, as_service=False, as_super=False, as_user=False):
        headers = {}
        if as_super and self.superuser_token:
            headers["Authorization"] = self.superuser_token
        elif as_user and self.user_token:
            headers["Authorization"] = "Bearer " + self.user_token
        elif as_service and self.service_token:
            headers["X-Yuqi-Service-Token"] = self.service_token
        return req(method, self.base + path, body, headers)


def bootstrap(base="http://127.0.0.1:18140", admin_email="admin@demo.local",
              admin_password="admin123456", service_token="svc-token-123"):
    pb = PB(base, service_token=service_token)
    # 1. superuser auth
    s, b = req("POST", base + "/api/collections/_superusers/auth-with-password",
               {"identity": admin_email, "password": admin_password})
    if s != 200:
        raise RuntimeError("superuser auth failed: %s %s" % (s, b))
    pb.superuser_token = b["token"]

    # 2. tenant (idempotent)
    s, b = req("GET", base + "/api/collections/tenants/records?filter=" +
               urllib.parse.quote("code = 'demo'"), headers={"Authorization": pb.superuser_token})
    tenant_id = None
    if s == 200 and b.get("items"):
        tenant_id = b["items"][0]["id"]
    if not tenant_id:
        s, b = req("POST", base + "/api/collections/tenants/records",
                   {"code": "demo", "name": "演示租户", "status": "ACTIVE"},
                   {"Authorization": pb.superuser_token})
        if s not in (200, 201):
            raise RuntimeError("tenant create failed: %s %s" % (s, b))
        tenant_id = b.get("id")

    # 3. region + store (idempotent)
    def find_or_create(coll, filter, body):
        s, b = req("GET", base + "/api/collections/%s/records?filter=" % coll +
                   urllib.parse.quote(filter), headers={"Authorization": pb.superuser_token})
        if s == 200 and b.get("items"):
            return b["items"][0]["id"]
        s, b = req("POST", base + "/api/collections/%s/records" % coll, body,
                   {"Authorization": pb.superuser_token})
        if s not in (200, 201):
            raise RuntimeError("%s create failed: %s %s" % (coll, s, b))
        return b["id"]

    region_id = find_or_create("regions", "code = 'R-HD'",
                               {"name": "华东大区", "code": "R-HD", "status": "ACTIVE", "tenant": tenant_id})
    store_id = find_or_create("stores", "name = '上海静安店'",
                              {"name": "上海静安店", "region": region_id, "status": "ACTIVE", "tenant": tenant_id})

    # 4. employee (idempotent)
    employee_id = find_or_create("employees", "phone = '13800000001'",
                                 {"name": "张三", "phone": "13800000001", "role": "店员",
                                  "store": store_id, "status": "在职", "tenant": tenant_id})

    # 5. app_users (auth collection) — provide tokenKey explicitly (PB quirk)
    def make_user(username, display_name, role_code, employee="", store="", org=""):
        body = {
            "tokenKey": rand_token_key(),
            "username": username,
            "email": username + "@demo.local",
            "password": "Passw0rd!",
            "passwordConfirm": "Passw0rd!",
            "display_name": display_name,
            "role_code": role_code,
            "status": "ACTIVE",
            "tenant": tenant_id,
            "employee": employee,
            "assigned_store": store,
            "assigned_org": org,
        }
        s, b = req("POST", base + "/api/collections/app_users/records", body,
                   {"Authorization": pb.superuser_token})
        if s not in (200, 201):
            raise RuntimeError("app_user %s failed: %s %s" % (username, s, b))
        return b["id"]

    def find_user(username):
        s, b = req("GET", base + "/api/collections/app_users/records?filter=" +
                   urllib.parse.quote("email = '%s@demo.local'" % username),
                   headers={"Authorization": pb.superuser_token})
        if s == 200 and b.get("items"):
            return b["items"][0]["id"]
        return None

    def make_user(username, display_name, role_code, employee="", store="", org=""):
        existing = find_user(username)
        if existing:
            return existing
        body = {
            "tokenKey": rand_token_key(),
            "username": username,
            "email": username + "@demo.local",
            "password": "Passw0rd!",
            "passwordConfirm": "Passw0rd!",
            "display_name": display_name,
            "role_code": role_code,
            "status": "ACTIVE",
            "tenant": tenant_id,
            "employee": employee,
            "assigned_store": store,
            "assigned_org": org,
        }
        s, b = req("POST", base + "/api/collections/app_users/records", body,
                   {"Authorization": pb.superuser_token})
        if s not in (200, 201):
            raise RuntimeError("app_user %s failed: %s %s" % (username, s, b))
        return b["id"]

    admin_id = make_user("admin", "系统管理员", "ADMIN")
    compliance_id = make_user("compliance", "合规专员", "COMPLIANCE")
    sm_id = make_user("sm_ja", "静安店长", "STORE_MANAGER", store=store_id)
    emp_id = make_user("emp_zhang", "张三", "EMPLOYEE", employee=employee_id)
    region_mgr_id = make_user("rm_hd", "华东区域经理", "REGION_MANAGER", org=region_id)

    # 6. data scopes (idempotent, replace)
    def set_scope(user_id, scope_type, org="", store=""):
        req("DELETE", base + "/api/collections/user_data_scopes/records?filter=" +
            urllib.parse.quote("user = '%s'" % user_id), headers={"Authorization": pb.superuser_token})
        return req("POST", base + "/api/collections/user_data_scopes/records",
                   {"tenant": tenant_id, "user": user_id, "scope_type": scope_type,
                    "org_node": org, "store": store, "status": "ACTIVE"},
                   {"Authorization": pb.superuser_token})

    set_scope(admin_id, "ALL")
    set_scope(compliance_id, "ALL")
    set_scope(sm_id, "STORE", store=store_id)
    set_scope(emp_id, "SELF")
    set_scope(region_mgr_id, "ORG_TREE", org=region_id)

    return {
        "base": base,
        "service_token": service_token,
        "superuser_token": pb.superuser_token,
        "tenant_id": tenant_id,
        "region_id": region_id,
        "store_id": store_id,
        "employee_id": employee_id,
        "users": {
            "admin": admin_id, "compliance": compliance_id, "store_manager": sm_id,
            "employee": emp_id, "region_manager": region_mgr_id,
        },
        "passwords": {"app_user": "Passw0rd!", "superuser": admin_password},
    }
