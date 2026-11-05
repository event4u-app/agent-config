"""Fold the re-asked uo-c-model-03 ruling into Google's uo-human reply; print round-2 verdicts."""
import json, os

O = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out') + '/'


def parse(t):
    return json.loads(t[t.index('{'):t.rindex('}') + 1])


re_ = parse(open(O + 'reask-uo-human.google.txt').read())
print('reask', [(i['id'], [(f['path'].split('/')[-1], f['verdict']) for f in i['files']]) for i in re_['items']])
d = json.load(open(O + 'rulings-uo-human.json'))
for r in d['responses']:
    if r['provider'] == 'google':
        j = parse(r['text'])
        have = {i['id'] for i in j['items']}
        j['items'] += [i for i in re_['items'] if i['id'] not in have]
        r['text'] = json.dumps(j)
        r['note'] = 'uo-c-model-03 skipped in the first reply; added from reask-uo-human.google.txt'
json.dump(d, open(O + 'rulings-uo-human.json', 'w'), indent=1)
r2 = json.load(open(O + 'round2-ls-human.json'))
for r in r2['responses']:
    print('round2', r['provider'], [(f['path'].split('/')[-1], f['verdict']) for i in parse(r['text'])['items'] for f in i['files']])
