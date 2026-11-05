"""Every PHP edge endpoint and target of one subject, as <file>:<line> lines for enclosing.php."""
import glob, json, os, sys

V21 = os.path.dirname(os.path.abspath(__file__))
prefix = sys.argv[1]
sites = set()
for f in glob.glob(os.path.join(V21, f'edges-{prefix}*.json')):
    for it in json.load(open(f)):
        t = it['target']
        sites.add(f"{t['file']}:{t['line']}")
        for e in it['edges']:
            sites.add(f"{e['from_file']}:{e['from_line']}")
            sites.add(f"{e['to_file']}:{e['to_line']}")
for s in sorted(x for x in sites if x.split(':')[0].endswith('.php') and not x.split(':')[0].endswith('.blade.php')):
    print(s)
