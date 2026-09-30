package com.pcguard.agent.service;
import com.pcguard.agent.model.*; import com.pcguard.agent.model.Enums.FaultState; import java.time.Instant; import java.util.*;

/** Suppresses spikes and duplicate reports, emitting only confirmed active/recovered transitions. */
public final class FaultStateService {
 private final int confirmations; private final Map<String,Integer> seen=new HashMap<>(); private final Map<String,Integer> absent=new HashMap<>(); private final Map<String,Fault> active=new HashMap<>();
 public FaultStateService(int confirmations){this.confirmations=confirmations;}
 public synchronized List<Fault> transitions(List<Fault> faults){ Map<String,Fault> now=new HashMap<>(); faults.forEach(f->now.put(f.key(),f)); List<Fault> events=new ArrayList<>(); for(var e:now.entrySet()){String key=e.getKey(); absent.remove(key); int count=seen.merge(key,1,Integer::sum); if(count>=confirmations&&!active.containsKey(key)){active.put(key,e.getValue());events.add(e.getValue());}} for(String key:new HashSet<>(active.keySet())) if(!now.containsKey(key)){seen.remove(key); if(absent.merge(key,1,Integer::sum)>=confirmations){Fault old=active.remove(key); absent.remove(key);events.add(new Fault(old.computerId(),old.hostname(),Instant.now(),old.faultCode(),old.category(),old.component(),old.metric(),old.currentValue(),old.threshold(),old.severity(),FaultState.RECOVERED,old.message(),old.recommendedAction()));}} return events; }
 public synchronized List<Fault> activeFaults(){return List.copyOf(active.values());}
}
