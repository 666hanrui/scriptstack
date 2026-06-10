import os

base_dir = "/Users/hanrui/rerust/geoworld-backend/src/main/java/com/geoworld/controller"

controllers = {
    "LandscapeController.java": """package com.geoworld.controller;

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
    public Result<List<Landscape>> list(@RequestParam(required = false) Long cityId,
                                        @RequestParam(required = false) String type) {
        QueryWrapper<Landscape> wrapper = new QueryWrapper<>();
        if (cityId != null) {
            wrapper.eq("city_id", cityId);
        }
        if (type != null && !type.isEmpty()) {
            wrapper.eq("type", type);
        }
        return Result.success(landscapeService.list(wrapper));
    }

    @GetMapping("/{code}")
    public Result<Landscape> detail(@PathVariable String code) {
        QueryWrapper<Landscape> wrapper = new QueryWrapper<>();
        wrapper.eq("code", code);
        return Result.success(landscapeService.getOne(wrapper));
    }
}
""",
    "KnowledgeController.java": """package com.geoworld.controller;

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
    public Result<List<Knowledge>> list(@RequestParam(required = false) Long landscapeId,
                                        @RequestParam(required = false) String category) {
        QueryWrapper<Knowledge> wrapper = new QueryWrapper<>();
        if (landscapeId != null) {
            wrapper.eq("landscape_id", landscapeId);
        }
        if (category != null && !category.isEmpty()) {
            wrapper.eq("category", category);
        }
        return Result.success(knowledgeService.list(wrapper));
    }

    @GetMapping("/{code}")
    public Result<Knowledge> detail(@PathVariable String code) {
        QueryWrapper<Knowledge> wrapper = new QueryWrapper<>();
        wrapper.eq("code", code);
        return Result.success(knowledgeService.getOne(wrapper));
    }
}
""",
    "TaskController.java": """package com.geoworld.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.geoworld.common.Result;
import com.geoworld.entity.Task;
import com.geoworld.service.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

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

    @GetMapping("/{id}")
    public Result<Task> detail(@PathVariable Long id) {
        return Result.success(taskService.getById(id));
    }

    @PostMapping("/submit")
    public Result<Map<String, Object>> submit(@RequestBody Map<String, Object> request) {
        Map<String, Object> response = new HashMap<>();
        response.put("score", 85);
        response.put("feedback", "回答得很棒！基本覆盖了核心知识点，如果能补充一些细节说明就更完美了。");
        response.put("referenceAnswer", "参考答案：这是一个典型的自然地理特征，受气候与地形共同影响...");
        return Result.success(response);
    }
}
""",
    "AiController.java": """package com.geoworld.controller;

import com.geoworld.common.Result;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    @PostMapping("/ask")
    public Result<Map<String, Object>> ask(@RequestBody Map<String, String> request) {
        String prompt = request.getOrDefault("prompt", "");
        
        Map<String, Object> response = new HashMap<>();
        response.put("reply", "AI助手收到您关于【" + prompt + "】的提问。\\n这是一个典型的相关现象，当前为您提供的是后端模拟返回的数据。接入大语言模型后，这里将提供详细的解答。");
        response.put("suggestedQuestions", Arrays.asList("请问它和同类现象有什么核心区别？", "能不能详细解释一下其中的原理？"));
        
        return Result.success(response);
    }
}
"""
}

for fname, content in controllers.items():
    with open(os.path.join(base_dir, fname), "w") as f:
        f.write(content)

print("Controllers updated.")
