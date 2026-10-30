import re
import sys

print('=== MASKED CADDYFILE INSPECTION ===')
try:
    with open('/etc/caddy/Caddyfile') as f:
        content = f.read()
    # Mask bcrypt hashes, passwords and tokens
    content = re.sub(r'(\$2[aby]\$[0-9]{2}\$[A-Za-z0-9./]{25,})', '***BCRYPT_HASH***', content)
    content = re.sub(r'(basicauth[^{}\n]*\{)([^}]+)(\})', r'\1\n        # *** CREDENTIALS MASKED ***\n    \3', content, flags=re.DOTALL)
    print(content)
except Exception as e:
    print('Could not read /etc/caddy/Caddyfile:', e)
