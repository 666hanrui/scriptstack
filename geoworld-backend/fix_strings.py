import os
import glob

base_dir = "/Users/hanrui/rerust/geoworld-backend/src/main/java/com/geoworld"
files = glob.glob(base_dir + '/**/*.java', recursive=True)

for f in files:
    with open(f, 'r') as file:
        content = file.read()
        
    # Replace actual newlines inside strings with \\n
    # A bit hard to regex, but let's just rewrite the specific lines!
