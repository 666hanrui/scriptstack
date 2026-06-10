package com.geoworld.controller;

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
