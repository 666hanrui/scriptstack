import os
import glob

base_dir = "/Users/hanrui/rerust/geoworld-backend/src/main/java/com/geoworld"
files = glob.glob(base_dir + '/**/*.java', recursive=True)

for f in files:
    with open(f, 'r') as file:
        content = file.read()
    if '\\n' in content:
        content = content.replace('\\n', '\n')
        with open(f, 'w') as file:
            file.write(content)

print("Fixed newlines")
