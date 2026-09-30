package com.pcguard.agent.detector;
import com.pcguard.agent.model.*; import java.util.List;
public interface FaultDetector { List<Fault> detect(Snapshot snapshot); }
