package com.geoworld.config;

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
                    if (node.has("id")) landscape.setCode(node.get("id").asText());
                    if (node.has("type")) landscape.setType(node.get("type").asText());
                    else landscape.setType("自然景观"); // Default mock value if not present
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
                    if (node.has("id")) knowledge.setCode(node.get("id").asText());
                    if (node.has("category")) knowledge.setCategory(node.get("category").asText());
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
