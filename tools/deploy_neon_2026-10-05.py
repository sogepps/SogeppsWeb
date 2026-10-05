# Usage (PowerShell): $env:DEPLOY_PW="<Administrator password>"; python tools/deploy_neon_2026-10-05.py          (dry run: lists new/changed files)
#                      $env:DEPLOY_PW="..."; python tools/deploy_neon_2026-10-05.py --apply  (backs up changed live files to C:inetpubbackup2026-10-05-neonkaleler, uploads, verifies by MD5)
import paramiko, hashlib, os, sys, posixpath, io
LOCAL = 'E:/Soge/SogeppsWeb'
REMOTE = '/C:/inetpub/wwwroot'
BACKUP = '/C:/inetpub/backup/2026-10-05-neonkaleler'
SP = os.path.join(os.environ.get('TEMP', '.'), 'sogepps-deploy-live')
LANGS = ['en','de','fr','es','it','pt','nl','ru','ja','ko','ar','hi','id','pl']
APPLY = '--apply' in sys.argv

files = []
for root, _, fs in os.walk(LOCAL + '/NeonKaleler'):
    for f in fs:
        files.append(os.path.relpath(os.path.join(root, f), LOCAL).replace('\\', '/'))
files.append('HomeParty/index.html'); files.append('HomeParty/img/storyCreation.png')
files += [f'HomeParty/{l}/index.html' for l in LANGS]
files.append('MainSite/index.html'); files += [f'MainSite/{l}/index.html' for l in LANGS]
files += ['MainSite/sitemap.xml', 'MainSite/img/neonkaleler-icon.png']
files = sorted(set(files))

c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('185.231.111.133', 22, 'Administrator', pkey=paramiko.Ed25519Key.from_private_key_file(os.path.expanduser('~/.ssh/sogepps_deploy')), timeout=30, allow_agent=False, look_for_keys=False)
sftp = c.open_sftp()

def md5(b): return hashlib.md5(b).hexdigest()
def mkdirs(path):
    parts = path.strip('/').split('/'); cur = ''
    for p in parts:
        cur += '/' + p
        try: sftp.stat(cur)
        except IOError: sftp.mkdir(cur)

new, changed, same = [], [], []
for rel in files:
    lb = open(f'{LOCAL}/{rel}', 'rb').read()
    rp = f'{REMOTE}/{rel}'
    try:
        rb = sftp.open(rp, 'rb').read()
    except IOError:
        new.append(rel); continue
    (same if md5(rb) == md5(lb) else changed).append(rel)
    if md5(rb) != md5(lb):
        d = f'{SP}/live/{rel}'; os.makedirs(os.path.dirname(d), exist_ok=True); open(d, 'wb').write(rb)
print('new', len(new), 'changed', len(changed), 'same', len(same))
print('changed:', changed)
print('new (non-neon/img):', [n for n in new if not n.startswith('NeonKaleler/')])
if APPLY:
    mkdirs(BACKUP)
    for rel in changed:
        bp = f'{BACKUP}/{rel}'; mkdirs(posixpath.dirname(bp))
        # copy live -> backup
        data = open(f'{SP}/live/{rel}', 'rb').read()
        with sftp.open(bp, 'wb') as fh: fh.write(data)
    print('backup done:', len(changed))
    for rel in new + changed:
        rp = f'{REMOTE}/{rel}'; mkdirs(posixpath.dirname(rp))
        sftp.put(f'{LOCAL}/{rel}', rp)
    print('uploaded', len(new) + len(changed))
    # verify
    bad = 0
    for rel in files:
        lb = open(f'{LOCAL}/{rel}', 'rb').read()
        rb = sftp.open(f'{REMOTE}/{rel}', 'rb').read()
        if md5(lb) != md5(rb): bad += 1; print('MISMATCH', rel)
    print('verify mismatches:', bad)
sftp.close(); c.close()
