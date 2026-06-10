package com.geoworld.controller;

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
