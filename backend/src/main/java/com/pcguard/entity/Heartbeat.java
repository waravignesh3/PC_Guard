package com.pcguard.entity;
import jakarta.persistence.*; import java.time.Instant;
@Entity @Table(name="heartbeats") public class Heartbeat { @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id; @ManyToOne(optional=false) @JoinColumn(name="computer_id") public Computer computer; public Instant timestamp; @Column(name="agent_version") public String agentVersion; @Column(name="ip_address") public String ipAddress; public String status; }
