package com.quaternity.server.model;

public class MoveRecord {
    private int moveIndex;
    private ArmyColor player;
    private ArmyColor nextPlayer;
    private long timestamp;
    private long remainingMs;
    private long timeBeforeIncrementMs;

    public MoveRecord() {}

    public MoveRecord(int moveIndex, ArmyColor player, ArmyColor nextPlayer, long timestamp, long remainingMs) {
        this(moveIndex, player, nextPlayer, timestamp, remainingMs, remainingMs);
    }

    public MoveRecord(int moveIndex, ArmyColor player, ArmyColor nextPlayer, long timestamp, long remainingMs, long timeBeforeIncrementMs) {
        this.moveIndex = moveIndex;
        this.player = player;
        this.nextPlayer = nextPlayer;
        this.timestamp = timestamp;
        this.remainingMs = remainingMs;
        this.timeBeforeIncrementMs = timeBeforeIncrementMs;
    }

    public long getTimeBeforeIncrementMs() {
        return timeBeforeIncrementMs;
    }

    public void setTimeBeforeIncrementMs(long timeBeforeIncrementMs) {
        this.timeBeforeIncrementMs = timeBeforeIncrementMs;
    }

    public int getMoveIndex() {
        return moveIndex;
    }

    public void setMoveIndex(int moveIndex) {
        this.moveIndex = moveIndex;
    }

    public ArmyColor getPlayer() {
        return player;
    }

    public void setPlayer(ArmyColor player) {
        this.player = player;
    }

    public ArmyColor getNextPlayer() {
        return nextPlayer;
    }

    public void setNextPlayer(ArmyColor nextPlayer) {
        this.nextPlayer = nextPlayer;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }

    public long getRemainingMs() {
        return remainingMs;
    }

    public void setRemainingMs(long remainingMs) {
        this.remainingMs = remainingMs;
    }
}
