package com.pcguard.agent.collector;

import com.pcguard.agent.model.Snapshot;
import java.time.Instant;
import java.util.*;
import org.slf4j.*;
import oshi.SystemInfo;
import oshi.hardware.*;
import oshi.software.os.*;

/** OSHI collector that stops querying an unavailable thermal source after its first failed probe. */
public final class OshiCollector {
 private static final Logger log=LoggerFactory.getLogger(OshiCollector.class);
 static { if (System.getProperty("oshi.os.windows.hkeyperfdata") == null) System.setProperty("oshi.os.windows.hkeyperfdata", "false"); }
 private final SystemInfo info=new SystemInfo(); private final HardwareAbstractionLayer hardware=info.getHardware(); private final boolean processCollectionEnabled; private long[] ticks; private boolean thermalSupported=true; private boolean thermalNotice;
 public OshiCollector(boolean processCollectionEnabled){this.processCollectionEnabled=processCollectionEnabled;}
 public Snapshot collect(Map<String,Object> identity) {
  OperatingSystem os=info.getOperatingSystem(); CentralProcessor processor=hardware.getProcessor(); double cpuLoad=ticks==null?Double.NaN:processor.getSystemCpuLoadBetweenTicks(ticks)*100; ticks=processor.getSystemCpuLoadTicks();
  Map<String,Object> cpu=new LinkedHashMap<>(); var id=processor.getProcessorIdentifier(); cpu.put("manufacturer",text(id.getVendor()));cpu.put("name",text(id.getName()));cpu.put("physicalCores",processor.getPhysicalProcessorCount());cpu.put("logicalProcessors",processor.getLogicalProcessorCount());cpu.put("frequencyHz",processor.getMaxFreq());cpu.put("usagePercent",nonNegative(cpuLoad));
  GlobalMemory global=hardware.getMemory();long total=global.getTotal(), available=global.getAvailable();Map<String,Object> memory=new LinkedHashMap<>();memory.put("totalBytes",total);memory.put("availableBytes",available);memory.put("usedBytes",Math.max(0,total-available));memory.put("usagePercent",total>0?(total-available)*100d/total:null);memory.put("swapUsedBytes",global.getVirtualMemory().getSwapUsed());memory.put("swapTotalBytes",global.getVirtualMemory().getSwapTotal());
  List<Map<String,Object>> disks=new ArrayList<>();for(OSFileStore fs:os.getFileSystem().getFileStores()){long capacity=fs.getTotalSpace(),free=fs.getUsableSpace();if(capacity<=0)continue;Map<String,Object> d=new LinkedHashMap<>();d.put("mount",text(fs.getMount()));d.put("name",text(fs.getName()));d.put("type",text(fs.getType()));d.put("totalBytes",capacity);d.put("freeBytes",free);d.put("usedBytes",capacity-free);d.put("usagePercent",(capacity-free)*100d/capacity);disks.add(d);}
  List<Map<String,Object>> networks=new ArrayList<>();for(NetworkIF net:hardware.getNetworkIFs()){net.updateAttributes();Map<String,Object> n=new LinkedHashMap<>();n.put("name",text(net.getName()));n.put("displayName",text(net.getDisplayName()));n.put("macAddress",text(net.getMacaddr()));n.put("ipv4",net.getIPv4addr()==null?List.of():Arrays.asList(net.getIPv4addr()));n.put("ipv6",net.getIPv6addr()==null?List.of():Arrays.asList(net.getIPv6addr()));n.put("up",net.getIfOperStatus()==NetworkIF.IfOperStatus.UP);n.put("bytesSent",net.getBytesSent());n.put("bytesReceived",net.getBytesRecv());networks.add(n);}
  List<Map<String,Object>> gpus=new ArrayList<>();for(GraphicsCard g:hardware.getGraphicsCards()){Map<String,Object> gpu=new LinkedHashMap<>();gpu.put("name",text(g.getName()));gpu.put("vendor",text(g.getVendor()));gpu.put("vramBytes",g.getVRam());gpu.put("versionInfo",text(g.getVersionInfo()));gpus.add(gpu);}
  Sensors sensors=hardware.getSensors();Map<String,Object> sensorData=new LinkedHashMap<>();sensorData.put("cpuTemperatureCelsius",temperature(sensors));sensorData.put("cpuVoltage",positive(sensors.getCpuVoltage()));sensorData.put("fanSpeedsRpm",fans(sensors.getFanSpeeds()));
  Map<String,Object> battery=new LinkedHashMap<>();if(!hardware.getPowerSources().isEmpty()){PowerSource p=hardware.getPowerSources().getFirst();battery.put("name",text(p.getName()));battery.put("remainingPercent",nonNegative(p.getRemainingCapacityPercent()*100));battery.put("charging",p.isCharging());battery.put("remainingTimeSeconds",nonNegative(p.getTimeRemainingEstimated()));battery.put("voltage",positive(p.getVoltage()));}
  List<Map<String,Object>> processes=new ArrayList<>();if(processCollectionEnabled)for(OSProcess p:os.getProcesses().stream().sorted(Comparator.comparingDouble(OSProcess::getProcessCpuLoadCumulative).reversed()).limit(10).toList()){Map<String,Object> process=new LinkedHashMap<>();process.put("name",text(p.getName()));process.put("pid",p.getProcessID());process.put("cpuPercent",nonNegative(p.getProcessCpuLoadCumulative()*100));process.put("residentBytes",p.getResidentSetSize());processes.add(process);}
  return new Snapshot(Instant.now(),identity,cpu,memory,disks,networks,gpus,sensorData,battery,processes,os.getSystemUptime());
 }
 private Double temperature(Sensors sensors){if(!thermalSupported)return null;double value=sensors.getCpuTemperature();if(!Double.isFinite(value)||value<=0){thermalSupported=false;if(!thermalNotice){log.info("CPU temperature sensor unavailable; reporting UNKNOWN.");thermalNotice=true;}return null;}return value;}
 private static List<Integer> fans(int[] values){return values==null?List.of():Arrays.stream(values).filter(v->v>0).boxed().toList();} private static Double nonNegative(double v){return Double.isFinite(v)&&v>=0?v:null;} private static Double positive(double v){return Double.isFinite(v)&&v>0?v:null;} private static String text(String v){return v==null||v.isBlank()?"UNKNOWN":v;}
}
