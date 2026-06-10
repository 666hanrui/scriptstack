package com.geoworld.controller;

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
