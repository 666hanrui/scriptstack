package com.geoworld.controller;

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
