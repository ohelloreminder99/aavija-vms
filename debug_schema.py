
import os
import json
import urllib.request
import urllib.error

# Try to load .env.local manually
env_vars = {}
try:
    with open('.env.local', 'r') as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                k, v = line.strip().split('=', 1)
                env_vars[k.strip()] = v.strip().strip("'").strip('"')
except:
    pass

url = env_vars.get('NEXT_PUBLIC_SUPABASE_URL')
key = env_vars.get('SUPABASE_SERVICE_ROLE_KEY')

if not url or not key:
    print(f"Missing environment variables: URL={bool(url)}, KEY={bool(key)}")
    exit(1)

def check_table(table_name):
    print(f"--- {table_name} Table Schema ---")
    request_url = f"{url}/rest/v1/{table_name}?limit=1"
    req = urllib.request.Request(request_url)
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    
    try:
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                data = json.loads(response.read().decode())
                if data:
                    print(f"COLUMNS: {list(data[0].keys())}")
                else:
                    print(f"Table {table_name} is empty")
            else:
                print(f"Error: {response.status}")
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} {e.reason} {e.read().decode()}")
    except Exception as e:
        print(f"Error: {str(e)}")

check_table("premises")
check_table("premise_applications")
