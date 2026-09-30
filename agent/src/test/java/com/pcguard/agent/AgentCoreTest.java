package com.pcguard.agent;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper; import com.pcguard.agent.config.AgentConfig; import com.pcguard.agent.detector.ThresholdDetector; import com.pcguard.agent.model.*; import com.pcguard.agent.model.Enums.*; import com.pcguard.agent.service.*; import java.nio.file.*; import java.time.Instant; import java.util.*; import org.junit.jupiter.api.Test;

class AgentCoreTest {
  private static Snapshot snapshot(double cpu,double memory,double disk,double temp){return new Snapshot(Instant.now(),Map.of("computerId","test","hostname","test-host"),Map.of("usagePercent",cpu),Map.of("usagePercent",memory,"availableBytes",2_000_000_000L),List.of(Map.of("mount","C:","usagePercent",disk,"freeBytes",20_000_000_000L)),List.of(),List.of(),Map.of("cpuTemperatureCelsius",temp),Map.of(),List.of(),0);}
  @Test void detectsCpuRamDiskAndTemperatureThresholds() throws Exception {var faults=new ThresholdDetector(AgentConfig.load()).detect(snapshot(97,92,93,91));assertEquals(Set.of("HIGH_CPU_USAGE","HIGH_MEMORY_USAGE","LOW_DISK_SPACE","HIGH_CPU_TEMPERATURE"),faults.stream().filter(f->f.faultCode().startsWith("HIGH")||f.faultCode().equals("LOW_DISK_SPACE")).map(Fault::faultCode).collect(java.util.stream.Collectors.toSet()));assertTrue(faults.stream().allMatch(f->f.severity()==FaultSeverity.CRITICAL));}
  @Test void confirmsAndRecoversFaultsWithoutDuplicates(){FaultStateService state=new FaultStateService(2);Fault f=new Fault("id","host",Instant.now(),"HIGH_CPU_USAGE",FaultCategory.CPU,"CPU","usage",97d,95d,FaultSeverity.CRITICAL,FaultState.ACTIVE,"high","act");assertTrue(state.transitions(List.of(f)).isEmpty());assertEquals(FaultState.ACTIVE,state.transitions(List.of(f)).getFirst().state());assertTrue(state.transitions(List.of(f)).isEmpty());assertTrue(state.transitions(List.of()).isEmpty());assertEquals(FaultState.RECOVERED,state.transitions(List.of()).getFirst().state());}
  @Test void queuesAndFlushesEvent() throws Exception {Path root=Files.createTempDirectory("pc-guard-test");OfflineQueue queue=new OfflineQueue(root,new ObjectMapper());queue.enqueue(Map.of("path","/faults","payload",Map.of("x",1)));List<Map<String,Object>> sent=new ArrayList<>();queue.flush(e->{sent.add(e);return true;});assertEquals(1,sent.size());assertEquals(0,Files.list(root.resolve("pending-events")).count());}
  @Test void archivesRetiredPreV1EventsWithoutBlockingV1Flush() throws Exception {
    Path root=Files.createTempDirectory("pc-guard-test");
    OfflineQueue queue=new OfflineQueue(root,new ObjectMapper());
    queue.enqueue(Map.of("path","/api/agent/telemetry","payload",Map.of("legacy",true)));
    queue.enqueue(Map.of("path","/api/agent/faults","payload",Map.of("legacy",true)));
    queue.enqueue(Map.of("path","/api/v1/agents/register","payload",Map.of("agentId","x")));
    assertEquals(2,queue.archiveRetiredApiEvents());
    List<Map<String,Object>> sent=new ArrayList<>();
    queue.flush(e->{sent.add(e);return true;});
    assertEquals(1,sent.size());
    assertEquals("/api/v1/agents/register",sent.getFirst().get("path"));
    assertEquals(0,Files.list(root.resolve("pending-events")).count());
    assertEquals(2,Files.list(root.resolve("retired-events")).count());
  }
  @Test void serializesFault() throws Exception {String json=new ObjectMapper().findAndRegisterModules().writeValueAsString(new Fault("id","host",Instant.now(),"CODE",FaultCategory.CPU,"CPU","usage",1d,2d,FaultSeverity.WARNING,FaultState.ACTIVE,"message","action"));assertTrue(json.contains("\"faultCode\":\"CODE\""));}
  @Test void unknownTemperatureDoesNotCreateOverheatingFault() throws Exception {Map<String,Object> sensors=new HashMap<>();sensors.put("cpuTemperatureCelsius",null);Snapshot unknown=new Snapshot(Instant.now(),Map.of("computerId","test","hostname","host"),Map.of("usagePercent",10d),Map.of("usagePercent",10d,"availableBytes",2_000_000_000L),List.of(),List.of(),List.of(),sensors,Map.of(),List.of(),0);assertTrue(new ThresholdDetector(AgentConfig.load()).detect(unknown).stream().noneMatch(f->f.faultCode().equals("HIGH_CPU_TEMPERATURE")));}
  @Test void fullBatteryDoesNotCreateLowBatteryFault() throws Exception {Snapshot full=new Snapshot(Instant.now(),Map.of("computerId","test","hostname","host"),Map.of("usagePercent",10d),Map.of("usagePercent",10d,"availableBytes",2_000_000_000L),List.of(),List.of(),List.of(),Map.of(),Map.of("remainingPercent",100d),List.of(),0);assertTrue(new ThresholdDetector(AgentConfig.load()).detect(full).stream().noneMatch(f->f.faultCode().equals("LOW_BATTERY")));}
}
