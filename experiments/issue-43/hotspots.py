import json,glob,collections
for path in glob.glob('/tmp/*.cpuprofile'):
 d=json.load(open(path)); counts=collections.Counter(d.get('samples',[])); nodes={n['id']:n for n in d['nodes']}
 for i,n in counts.most_common(15):
  f=nodes[i]['callFrame']; print(n, f['functionName'], f['url'], f['lineNumber'])
