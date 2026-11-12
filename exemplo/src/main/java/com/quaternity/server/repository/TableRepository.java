package com.quaternity.server.repository;

import com.quaternity.server.model.GameTable;

import java.util.List;
import java.util.Optional;

/**
 * Interface de abstração para acesso aos dados das Mesas do Quaternity.
 * 
 * Permite alternar de forma transparente entre armazenamento em memória (InMemoryTableRepository)
 * e banco de dados relacional (Spring Data JPA / PostgreSQL / MySQL) ou NoSQL (MongoDB / Redis).
 */
public interface TableRepository {
    GameTable save(GameTable table);
    Optional<GameTable> findById(String id);
    List<GameTable> findAll();
    boolean deleteById(String id);
    boolean existsById(String id);
    long count();
}
