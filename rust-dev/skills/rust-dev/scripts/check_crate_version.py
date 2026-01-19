#!/usr/bin/env python3
"""
Check the latest version of a Rust crate from crates.io.

Usage:
    python3 check_crate_version.py <crate-name>

Examples:
    python3 check_crate_version.py serde
    python3 check_crate_version.py tokio
"""

import sys
import json
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError


def get_latest_version(crate_name: str) -> dict:
    """
    Fetch the latest version information for a crate from crates.io.

    Returns a dict with keys:
        - name: crate name
        - version: latest version number
        - version_spec: version in x.x format (for Cargo.toml)
        - description: crate description
        - homepage: crate homepage URL
        - repository: crate repository URL
        - documentation: crate documentation URL
    """
    url = f"https://crates.io/api/v1/crates/{crate_name}"

    # crates.io requires a User-Agent header
    headers = {
        'User-Agent': 'rust-dev-skill/1.0'
    }

    try:
        request = Request(url, headers=headers)
        with urlopen(request, timeout=10) as response:
            data = json.loads(response.read().decode())

        crate = data.get('crate', {})
        versions = data.get('versions', [])

        if not versions:
            return {
                'error': f'No versions found for crate: {crate_name}'
            }

        # Get the latest non-yanked version
        latest = None
        for version in versions:
            if not version.get('yanked', False):
                latest = version
                break

        if not latest:
            return {
                'error': f'No non-yanked versions found for crate: {crate_name}'
            }

        version_num = latest['num']
        # Convert to x.x format (major.minor)
        parts = version_num.split('.')
        version_spec = f"{parts[0]}.{parts[1]}" if len(parts) >= 2 else version_num

        return {
            'name': crate_name,
            'version': version_num,
            'version_spec': version_spec,
            'description': crate.get('description', ''),
            'homepage': crate.get('homepage', ''),
            'repository': crate.get('repository', ''),
            'documentation': crate.get('documentation', f'https://docs.rs/{crate_name}'),
        }

    except HTTPError as e:
        if e.code == 404:
            return {
                'error': f'Crate not found: {crate_name}'
            }
        return {
            'error': f'HTTP error {e.code}: {e.reason}'
        }
    except URLError as e:
        return {
            'error': f'Network error: {e.reason}'
        }
    except Exception as e:
        return {
            'error': f'Unexpected error: {str(e)}'
        }


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 check_crate_version.py <crate-name>", file=sys.stderr)
        sys.exit(1)

    crate_name = sys.argv[1]
    result = get_latest_version(crate_name)

    if 'error' in result:
        print(f"Error: {result['error']}", file=sys.stderr)
        sys.exit(1)

    # Output in a format easy to parse
    print(f"Crate: {result['name']}")
    print(f"Latest Version: {result['version']}")
    print(f"Cargo.toml Format: {result['name']} = \"{result['version_spec']}\"")
    if result['description']:
        print(f"Description: {result['description']}")
    if result['documentation']:
        print(f"Documentation: {result['documentation']}")
    if result['repository']:
        print(f"Repository: {result['repository']}")


if __name__ == '__main__':
    main()
