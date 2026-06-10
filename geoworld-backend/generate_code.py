import os

base_dir = "/Users/hanrui/rerust/geoworld-backend/src/main/java/com/geoworld"

dirs = [
    "config",
    "controller",
    "entity",
    "mapper",
    "service/impl"
]

for d in dirs:
    os.makedirs(os.path.join(base_dir, d), exist_ok=True)

# 1. Controllers
with open(os.path.join(base_dir, "controller/HealthController.java"), "w") as f:
    f.write("""package com.geoworld.controller;

import com.geoworld.common.Result;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class HealthController {

    @GetMapping("/health")
    public Result<String> health() {
        return Result.success("GeoWorld Backend is running perfectly!");
    }
}
""")

# 2. Configs
with open(os.path.join(base_dir, "config/CorsConfig.java"), "w") as f:
    f.write("""package com.geoworld.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
""")

with open(os.path.join(base_dir, "config/MybatisPlusConfig.java"), "w") as f:
    f.write("""package com.geoworld.config;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@MapperScan("com.geoworld.mapper")
public class MybatisPlusConfig {
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        return interceptor;
    }
}
""")

# Entities definitions
entities = {
    "City": """    private String name;
    private String description;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;""",
    "Landscape": """    private Long cityId;
    private String name;
    private String description;
    private java.math.BigDecimal longitude;
    private java.math.BigDecimal latitude;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;""",
    "Knowledge": """    private Long landscapeId;
    private String title;
    private String content;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;""",
    "Task": """    private Long cityId;
    private String title;
    private String description;
    private Integer rewardPoints;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;"""
}

# Generate Entity, Mapper, Service, ServiceImpl
for entity_name, fields in entities.items():
    # Entity
    with open(os.path.join(base_dir, f"entity/{entity_name}.java"), "w") as f:
        f.write(f"""package com.geoworld.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("{entity_name.lower()}")
public class {entity_name} {{
    @TableId(type = IdType.AUTO)
    private Long id;
{fields}
}}
""")
    
    # Mapper
    with open(os.path.join(base_dir, f"mapper/{entity_name}Mapper.java"), "w") as f:
        f.write(f"""package com.geoworld.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.geoworld.entity.{entity_name};
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface {entity_name}Mapper extends BaseMapper<{entity_name}> {{
}}
""")

    # Service
    with open(os.path.join(base_dir, f"service/{entity_name}Service.java"), "w") as f:
        f.write(f"""package com.geoworld.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.geoworld.entity.{entity_name};

public interface {entity_name}Service extends IService<{entity_name}> {{
}}
""")

    # ServiceImpl
    with open(os.path.join(base_dir, f"service/impl/{entity_name}ServiceImpl.java"), "w") as f:
        f.write(f"""package com.geoworld.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.geoworld.entity.{entity_name};
import com.geoworld.mapper.{entity_name}Mapper;
import com.geoworld.service.{entity_name}Service;
import org.springframework.stereotype.Service;

@Service
public class {entity_name}ServiceImpl extends ServiceImpl<{entity_name}Mapper, {entity_name}> implements {entity_name}Service {{
}}
""")

print("All Day 2 files generated successfully.")
