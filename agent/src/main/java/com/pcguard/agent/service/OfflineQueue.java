package com.pcguard.agent.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class OfflineQueue {
  private static final Logger log = LoggerFactory.getLogger(OfflineQueue.class);
  private final Path directory;
  private final ObjectMapper mapper;

  public OfflineQueue(Path root, ObjectMapper mapper) throws IOException {
    directory = root.resolve("pending-events");
    this.mapper = mapper;
    Files.createDirectories(directory);
  }

  /** Archives events for endpoints removed before the v1 API migration so they cannot block current delivery. */
  public synchronized int archiveRetiredApiEvents() throws IOException {
    int moved = 0;
    try (var files = Files.list(directory)) {
      for (Path file : files.filter(p -> p.toString().endsWith(".json")).toList()) {
        if (archiveIfRetired(file)) moved++;
      }
    }
    return moved;
  }

  public synchronized void enqueue(Object value) throws IOException {
    Path temp = Files.createTempFile(directory, "event-", ".tmp");
    mapper.writeValue(temp.toFile(), value);
    Files.move(temp, directory.resolve("event-" + UUID.randomUUID() + ".json"), StandardCopyOption.ATOMIC_MOVE);
  }

  public synchronized void flush(Predicate<Map<String, Object>> sender) throws IOException {
    try (var files = Files.list(directory)) {
      for (Path file : files.filter(p -> p.toString().endsWith(".json")).toList()) {
        @SuppressWarnings("unchecked")
        Map<String, Object> event = mapper.readValue(file.toFile(), Map.class);
        if (retired(event)) {
          archiveIfRetired(file);
          continue;
        }
        if (sender.test(event)) Files.deleteIfExists(file);
        else break;
      }
    }
  }

  private boolean archiveIfRetired(Path file) {
    try {
      @SuppressWarnings("unchecked")
      Map<String, Object> event = mapper.readValue(file.toFile(), Map.class);
      if (!retired(event)) return false;
      Path archive = directory.getParent().resolve("retired-events");
      Files.createDirectories(archive);
      Files.move(file, archive.resolve(file.getFileName()), StandardCopyOption.REPLACE_EXISTING);
      log.warn("Discarding a queued event for the retired pre-v1 API path: {}", event.get("path"));
      return true;
    } catch (IOException ex) {
      log.warn("Unable to archive retired event file {}: {}", file.getFileName(), ex.getMessage());
      try {
        Files.deleteIfExists(file);
        log.warn("Deleted unarchivable retired event file {}", file.getFileName());
        return true;
      } catch (IOException delEx) {
        log.warn("Unable to delete retired event file {} either; will skip. Error: {}", file.getFileName(), delEx.getMessage());
        return false;
      }
    }
  }

  static boolean retired(Map<String, Object> event) {
    return String.valueOf(event.get("path")).startsWith("/api/agent/");
  }
}
