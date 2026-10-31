#!/usr/bin/env python3
"""Keeps GitHub's repository traffic beyond the 14 days GitHub shows.

Run daily by .github/workflows/traffic.yml, which commits the CSV files to the `traffic` branch.

    TRAFFIC_TOKEN=<token> python3 scripts/traffic-archive.py <owner/repo> <data dir>

The token needs read access to the repository's traffic: a fine-grained token with
"Administration: Read-only" on this repository, or a classic token with `repo`.

Files (all CSV, one row per day or per day and item):
  views.csv      date, views, unique visitors          (daily, from GitHub's last 14 days)
  clones.csv     date, clones, unique cloners          (daily; CI checkouts count too)
  referrers.csv  date, site, views, unique visitors    (GitHub's 14-day totals, as of that date)
  paths.csv      date, path, views, unique visitors    (the same, for the most viewed pages)
  repo.csv       date, stars, forks, watchers, open issues
"""
import csv
import datetime
import json
import os
import sys
import urllib.request

API = 'https://api.github.com/repos/'


def get(repo, path, token):
    request = urllib.request.Request(
        API + repo + path,
        headers={
            'Accept': 'application/vnd.github+json',
            'Authorization': f'Bearer {token}',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def read(file):
    if not os.path.exists(file):
        return []
    with open(file, newline='') as f:
        return list(csv.reader(f))[1:]


def write(file, header, rows):
    with open(file, 'w', newline='') as f:
        out = csv.writer(f)
        out.writerow(header)
        out.writerows(sorted(rows))


def merge_daily(file, header, entries):
    """Daily counts: newer fetches replace a day's row, since GitHub completes a day later."""
    rows = {row[0]: row for row in read(file)}
    for entry in entries:
        day = entry['timestamp'][:10]
        rows[day] = [day, str(entry['count']), str(entry['uniques'])]
    write(file, header, rows.values())


def merge_snapshot(file, header, today, items):
    """14-day totals: one snapshot per collection date; a rerun the same day replaces it."""
    rows = [row for row in read(file) if row[0] != today]
    rows += [[today, *item] for item in items]
    write(file, header, rows)


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    repo, data = sys.argv[1], sys.argv[2]
    token = os.environ.get('TRAFFIC_TOKEN')
    if not token:
        sys.exit('TRAFFIC_TOKEN is not set')
    os.makedirs(data, exist_ok=True)
    today = datetime.date.today().isoformat()

    views = get(repo, '/traffic/views', token)
    clones = get(repo, '/traffic/clones', token)
    referrers = get(repo, '/traffic/popular/referrers', token)
    paths = get(repo, '/traffic/popular/paths', token)
    info = get(repo, '', token)

    merge_daily(os.path.join(data, 'views.csv'), ['date', 'views', 'uniques'], views['views'])
    merge_daily(os.path.join(data, 'clones.csv'), ['date', 'clones', 'uniques'], clones['clones'])
    merge_snapshot(
        os.path.join(data, 'referrers.csv'),
        ['date', 'referrer', 'views', 'uniques'],
        today,
        [[r['referrer'], r['count'], r['uniques']] for r in referrers],
    )
    merge_snapshot(
        os.path.join(data, 'paths.csv'),
        ['date', 'path', 'views', 'uniques'],
        today,
        [[p['path'], p['count'], p['uniques']] for p in paths],
    )
    merge_snapshot(
        os.path.join(data, 'repo.csv'),
        ['date', 'stars', 'forks', 'watchers', 'open_issues'],
        today,
        [[info['stargazers_count'], info['forks_count'], info['subscribers_count'],
          info['open_issues_count']]],
    )

    print(f'{repo} on {today}: {views["count"]} views ({views["uniques"]} unique) and '
          f'{clones["count"]} clones ({clones["uniques"]} unique) in the last 14 days; '
          f'{info["stargazers_count"]} stars, {info["forks_count"]} forks')


if __name__ == '__main__':
    main()
