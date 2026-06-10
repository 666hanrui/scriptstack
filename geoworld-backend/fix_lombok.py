import os
import re

base_dir = "/Users/hanrui/rerust/geoworld-backend/src/main/java/com/geoworld"

# 1. Fix Result.java
result_path = os.path.join(base_dir, "common/Result.java")
with open(result_path, "r") as f:
    content = f.read()
content = content.replace("import lombok.Data;", "")
content = content.replace("@Data", "")
getters_setters = """
    public Integer getCode() { return code; }
    public void setCode(Integer code) { this.code = code; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public T getData() { return data; }
    public void setData(T data) { this.data = data; }
"""
content = content.replace("private T data;", "private T data;\\n" + getters_setters)
with open(result_path, "w") as f:
    f.write(content)

# 2. Fix GlobalExceptionHandler.java
geh_path = os.path.join(base_dir, "exception/GlobalExceptionHandler.java")
with open(geh_path, "r") as f:
    content = f.read()
content = content.replace("import lombok.extern.slf4j.Slf4j;", "import org.slf4j.Logger;\\nimport org.slf4j.LoggerFactory;")
content = content.replace("@Slf4j", "")
content = content.replace("public class GlobalExceptionHandler {", "public class GlobalExceptionHandler {\\n    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);")
with open(geh_path, "w") as f:
    f.write(content)

# 3. Fix Entities
entities_dir = os.path.join(base_dir, "entity")
for fname in os.listdir(entities_dir):
    if not fname.endswith(".java"): continue
    path = os.path.join(entities_dir, fname)
    with open(path, "r") as f:
        content = f.read()
    content = content.replace("import lombok.Data;", "")
    content = content.replace("@Data", "")
    
    # Extract fields
    fields = re.findall(r'private\\s+([A-Za-z0-9_<>]+)\\s+([a-zA-Z0-9_]+);', content)
    
    gs = ""
    for ftype, fname in fields:
        CapName = fname[0].upper() + fname[1:]
        gs += f"    public {ftype} get{CapName}() {{ return {fname}; }}\\n"
        gs += f"    public void set{CapName}({ftype} {fname}) {{ this.{fname} = {fname}; }}\\n"
    
    # Insert before last brace
    idx = content.rfind("}")
    content = content[:idx] + gs + "}\\n"
    with open(path, "w") as f:
        f.write(content)

print("Lombok removed.")
