package com.pcguard.agent.service;

import com.pcguard.agent.config.AgentConfig; import com.fasterxml.jackson.databind.ObjectMapper; import java.io.IOException; import java.net.InetAddress; import java.nio.file.*; import java.util.*; import oshi.SystemInfo;

public final class IdentityService {
  private final String id, hostname; private final AgentConfig config;
  public IdentityService(AgentConfig config, ObjectMapper mapper) throws IOException { this.config=config; hostname=host(); Path file=config.dataDirectory().resolve("agent-id.json"); Files.createDirectories(file.getParent()); if (Files.exists(file)) id=mapper.readTree(file.toFile()).path("computerId").asText(); else { String hardware = new SystemInfo().getHardware().getComputerSystem().getHardwareUUID(); id=hardware == null || hardware.isBlank() || "unknown".equalsIgnoreCase(hardware) ? UUID.randomUUID().toString() : hardware; mapper.writeValue(file.toFile(), Map.of("computerId", id)); } }
  private static String host() { try { return InetAddress.getLocalHost().getHostName(); } catch (Exception e) { return "UNKNOWN"; } }
  public String id(){ return id; } public String hostname(){ return hostname; }
  public Map<String,Object> identity(){
    var si=new SystemInfo(); var os=si.getOperatingSystem(); var values=new LinkedHashMap<String,Object>();
    values.put("computerId", id); values.put("hostname", hostname); values.put("osName", known(os.getFamily()));
    values.put("osVersion", known(os.getVersionInfo().getVersion())); values.put("architecture", known(System.getProperty("os.arch")));
    values.put("javaVersion", known(System.getProperty("java.version"))); values.put("oshiVersion", known(SystemInfo.class.getPackage().getImplementationVersion()));
    values.put("username", known(System.getProperty("user.name"))); values.put("agentVersion", known(config.text("agent.version")));
    return values;
  }
  private static String known(String value) { return value == null || value.isBlank() ? "UNKNOWN" : value; }
}
