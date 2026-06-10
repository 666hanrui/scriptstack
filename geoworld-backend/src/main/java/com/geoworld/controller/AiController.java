package com.geoworld.controller;

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
        response.put("reply", "AI助手收到您关于【" + prompt + "】的提问。\n这是一个典型的相关现象，当前为您提供的是后端模拟返回的数据。接入大语言模型后，这里将提供详细的解答。");
        response.put("suggestedQuestions", Arrays.asList("请问它和同类现象有什么核心区别？", "能不能详细解释一下其中的原理？"));
        
        return Result.success(response);
    }
}
