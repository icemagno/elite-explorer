package com.quaternity.server.repository;

import com.quaternity.server.model.GameTable;
import org.springframework.stereotype.Repository;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Implementação thread-safe em memória do TableRepository.
 * Utiliza ConcurrentHashMap para garantir concorrência de alta performance sem bloqueios lentos.
 */
@Repository
public class InMemoryTableRepository implements TableRepository {

    private final Map<String, GameTable> storage = new ConcurrentHashMap<>();

    @Override
    public GameTable save(GameTable table) {
        if (table == null || table.getId() == null) {
            throw new IllegalArgumentException("Mesa inválida para persistência.");
        }
        storage.put(table.getId(), table);
        return table;
    }

    @Override
    public Optional<GameTable> findById(String id) {
        if (id == null) return Optional.empty();
        return Optional.ofNullable(storage.get(id));
    }

    @Override
    public List<GameTable> findAll() {
        List<GameTable> list = new ArrayList<>(storage.values());
        list.sort(Comparator.comparingLong(GameTable::getCreatedAt));
        return list;
    }

    @Override
    public boolean deleteById(String id) {
        if (id == null) return false;
        return storage.remove(id) != null;
    }

    @Override
    public boolean existsById(String id) {
        return id != null && storage.containsKey(id);
    }

    @Override
    public long count() {
        return storage.size();
    }
}
