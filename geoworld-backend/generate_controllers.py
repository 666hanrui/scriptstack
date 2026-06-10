import os

base_dir = "/Users/hanrui/rerust/geoworld-backend/src/main/java/com/geoworld"

# 1. DataInitComponent
with open(os.path.join(base_dir, "config/DataInitComponent.java"), "w") as f:
    f.write("""package com.geoworld.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.geoworld.entity.City;
import com.geoworld.entity.Knowledge;
import com.geoworld.entity.Landscape;
import com.geoworld.entity.Task;
import com.geoworld.service.CityService;
import com.geoworld.service.KnowledgeService;
import com.geoworld.service.LandscapeService;
import com.geoworld.service.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.io.File;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Iterator;

@Component
public class DataInitComponent implements CommandLineRunner {

    @Autowired
    private CityService cityService;
    @Autowired
    private LandscapeService landscapeService;
    @Autowired
    private KnowledgeService knowledgeService;
    @Autowired
    private TaskService taskService;

    @Override
    public void run(String... args) throws Exception {
        // Init a city
        City city = new City();
        city.setName("默认城市(全球)");
        city.setDescription("包含所有景观点和任务的默认城市");
        city.setCreateTime(LocalDateTime.now());
        city.setUpdateTime(LocalDateTime.now());
        cityService.save(city);

        // Init a task
        Task task = new Task();
        task.setCityId(city.getId());
        task.setTitle("探索世界的奥秘");
        task.setDescription("完成任意3个知识点的学习即可获得奖励");
        task.setRewardPoints(100);
        task.setCreateTime(LocalDateTime.now());
        task.setUpdateTime(LocalDateTime.now());
        taskService.save(task);

        ObjectMapper mapper = new ObjectMapper();

        // Load Landscape
        File landscapeFile = new File("/Users/hanrui/rerust/geoworld-data/landscape.json");
        if (landscapeFile.exists()) {
            JsonNode rootNode = mapper.readTree(landscapeFile);
            if (rootNode.isArray()) {
                Iterator<JsonNode> elements = rootNode.elements();
                while (elements.hasNext()) {
                    JsonNode node = elements.next();
                    Landscape landscape = new Landscape();
                    landscape.setCityId(city.getId());
                    landscape.setName(node.has("name") ? node.get("name").asText() : "未知景点");
                    landscape.setDescription(node.has("description") ? node.get("description").asText() : "");
                    
                    if (node.has("coordinates")) {
                        JsonNode coords = node.get("coordinates");
                        if (coords.has("longitude")) landscape.setLongitude(new BigDecimal(coords.get("longitude").asText()));
                        if (coords.has("latitude")) landscape.setLatitude(new BigDecimal(coords.get("latitude").asText()));
                    }
                    landscape.setCreateTime(LocalDateTime.now());
                    landscape.setUpdateTime(LocalDateTime.now());
                    landscapeService.save(landscape);
                }
            }
        }

        // Load Knowledge
        File knowledgeFile = new File("/Users/hanrui/rerust/geoworld-data/knowledge.json");
        if (knowledgeFile.exists()) {
            JsonNode rootNode = mapper.readTree(knowledgeFile);
            if (rootNode.isArray()) {
                Iterator<JsonNode> elements = rootNode.elements();
                while (elements.hasNext()) {
                    JsonNode node = elements.next();
                    Knowledge knowledge = new Knowledge();
                    knowledge.setTitle(node.has("title") ? node.get("title").asText() : "未知知识点");
                    
                    String content = "";
                    if (node.has("summary")) content += node.get("summary").asText() + "\\n";
                    if (node.has("content")) content += node.get("content").asText();
                    knowledge.setContent(content);
                    
                    knowledge.setCreateTime(LocalDateTime.now());
                    knowledge.setUpdateTime(LocalDateTime.now());
                    knowledgeService.save(knowledge);
                }
            }
        }
    }
}
""")

# 2. Controllers
controllers = {
    "City": """package com.geoworld.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.geoworld.common.Result;
import com.geoworld.entity.City;
import com.geoworld.service.CityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/city")
public class CityController {
    @Autowired
    private CityService cityService;

    @GetMapping("/list")
    public Result<List<City>> list() {
        return Result.success(cityService.list());
    }
}
""",
    "Landscape": """package com.geoworld.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.geoworld.common.Result;
import com.geoworld.entity.Landscape;
import com.geoworld.service.LandscapeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/landscape")
public class LandscapeController {
    @Autowired
    private LandscapeService landscapeService;

    @GetMapping("/list")
    public Result<List<Landscape>> list(@RequestParam(required = false) Long cityId) {
        QueryWrapper<Landscape> wrapper = new QueryWrapper<>();
        if (cityId != null) {
            wrapper.eq("city_id", cityId);
        }
        return Result.success(landscapeService.list(wrapper));
    }

    @GetMapping("/detail/{id}")
    public Result<Landscape> detail(@PathVariable Long id) {
        return Result.success(landscapeService.getById(id));
    }
}
""",
    "Knowledge": """package com.geoworld.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.geoworld.common.Result;
import com.geoworld.entity.Knowledge;
import com.geoworld.service.KnowledgeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/knowledge")
public class KnowledgeController {
    @Autowired
    private KnowledgeService knowledgeService;

    @GetMapping("/list")
    public Result<List<Knowledge>> list(@RequestParam(required = false) Long landscapeId) {
        QueryWrapper<Knowledge> wrapper = new QueryWrapper<>();
        if (landscapeId != null) {
            wrapper.eq("landscape_id", landscapeId);
        }
        return Result.success(knowledgeService.list(wrapper));
    }

    @GetMapping("/detail/{id}")
    public Result<Knowledge> detail(@PathVariable Long id) {
        return Result.success(knowledgeService.getById(id));
    }
}
""",
    "Task": """package com.geoworld.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.geoworld.common.Result;
import com.geoworld.entity.Task;
import com.geoworld.service.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/task")
public class TaskController {
    @Autowired
    private TaskService taskService;

    @GetMapping("/list")
    public Result<List<Task>> list(@RequestParam(required = false) Long cityId) {
        QueryWrapper<Task> wrapper = new QueryWrapper<>();
        if (cityId != null) {
            wrapper.eq("city_id", cityId);
        }
        return Result.success(taskService.list(wrapper));
    }
}
""",
    "Ai": """package com.geoworld.controller;

import com.geoworld.common.Result;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    @PostMapping("/chat")
    public Result<String> chat(@RequestBody Map<String, String> request) {
        String prompt = request.getOrDefault("prompt", "");
        // 占位符返回模板化数据
        return Result.success("AI 助手收到您的问题：\\n" + prompt + "\\n\\n【这是后端的 AI 占位回复。后续将接入真实大语言模型流式响应】");
    }
}
"""
}

for name, content in controllers.items():
    with open(os.path.join(base_dir, f"controller/{name}Controller.java"), "w") as f:
        f.write(content)

print("Day 3 and 4 files generated.")
