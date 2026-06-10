package com.geoworld.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.geoworld.entity.Knowledge;
import com.geoworld.mapper.KnowledgeMapper;
import com.geoworld.service.KnowledgeService;
import org.springframework.stereotype.Service;

@Service
public class KnowledgeServiceImpl extends ServiceImpl<KnowledgeMapper, Knowledge> implements KnowledgeService {
}
