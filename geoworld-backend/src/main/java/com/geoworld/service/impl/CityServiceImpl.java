package com.geoworld.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.geoworld.entity.City;
import com.geoworld.mapper.CityMapper;
import com.geoworld.service.CityService;
import org.springframework.stereotype.Service;

@Service
public class CityServiceImpl extends ServiceImpl<CityMapper, City> implements CityService {
}
