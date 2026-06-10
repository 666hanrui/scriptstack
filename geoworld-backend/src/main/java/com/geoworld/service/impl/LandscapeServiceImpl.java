package com.geoworld.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.geoworld.entity.Landscape;
import com.geoworld.mapper.LandscapeMapper;
import com.geoworld.service.LandscapeService;
import org.springframework.stereotype.Service;

@Service
public class LandscapeServiceImpl extends ServiceImpl<LandscapeMapper, Landscape> implements LandscapeService {
}
