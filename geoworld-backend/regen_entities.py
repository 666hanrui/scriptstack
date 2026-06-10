import os

base_dir = "/Users/hanrui/rerust/geoworld-backend/src/main/java/com/geoworld/entity"

entities = {
    "City": [
        ("Long", "id"),
        ("String", "name"),
        ("String", "description"),
        ("LocalDateTime", "createTime"),
        ("LocalDateTime", "updateTime")
    ],
    "Landscape": [
        ("Long", "id"),
        ("String", "code"),
        ("String", "type"),
        ("Long", "cityId"),
        ("String", "name"),
        ("String", "description"),
        ("java.math.BigDecimal", "longitude"),
        ("java.math.BigDecimal", "latitude"),
        ("LocalDateTime", "createTime"),
        ("LocalDateTime", "updateTime")
    ],
    "Knowledge": [
        ("Long", "id"),
        ("String", "code"),
        ("String", "category"),
        ("Long", "landscapeId"),
        ("String", "title"),
        ("String", "content"),
        ("LocalDateTime", "createTime"),
        ("LocalDateTime", "updateTime")
    ],
    "Task": [
        ("Long", "id"),
        ("Long", "cityId"),
        ("String", "title"),
        ("String", "description"),
        ("Integer", "rewardPoints"),
        ("LocalDateTime", "createTime"),
        ("LocalDateTime", "updateTime")
    ]
}

for entity_name, fields in entities.items():
    code = f"""package com.geoworld.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("{entity_name.lower()}")
public class {entity_name} {{
"""
    for ftype, fname in fields:
        if fname == "id":
            code += f'    @TableId(type = IdType.AUTO)\n'
        code += f"    private {ftype} {fname};\n"
        
    for ftype, fname in fields:
        CapName = fname[0].upper() + fname[1:]
        code += f"    public {ftype} get{CapName}() {{ return {fname}; }}\n"
        code += f"    public void set{CapName}({ftype} {fname}) {{ this.{fname} = {fname}; }}\n"
    
    code += "}\n"
    
    with open(os.path.join(base_dir, f"{entity_name}.java"), "w") as f:
        f.write(code)

print("Entities regenerated.")
