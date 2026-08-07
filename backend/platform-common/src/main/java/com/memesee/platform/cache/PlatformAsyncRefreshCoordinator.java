package com.memesee.platform.cache;

import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.Executor;
import java.util.concurrent.ForkJoinPool;

public final class PlatformAsyncRefreshCoordinator {

    public enum TriggerOutcome {
        EXECUTED,
        JOINED
    }

    private final Executor executor;
    private final ConcurrentMap<String, CompletableFuture<Void>> inFlightTasks = new ConcurrentHashMap<>();

    public PlatformAsyncRefreshCoordinator() {
        this(ForkJoinPool.commonPool());
    }

    public PlatformAsyncRefreshCoordinator(Executor executor) {
        this.executor = Objects.requireNonNull(executor, "executor must not be null");
    }

    public TriggerOutcome trigger(String key, Runnable refresher) {
        return trigger(key, refresher, null);
    }

    public TriggerOutcome trigger(String key, Runnable refresher, Runnable onJoin) {
        Objects.requireNonNull(refresher, "refresher must not be null");
        if (key == null || key.isBlank()) {
            executor.execute(refresher);
            return TriggerOutcome.EXECUTED;
        }

        CompletableFuture<Void> task = new CompletableFuture<>();
        CompletableFuture<Void> existingTask = inFlightTasks.putIfAbsent(key, task);
        if (existingTask != null) {
            if (onJoin != null) {
                onJoin.run();
            }
            return TriggerOutcome.JOINED;
        }

        executor.execute(() -> {
            try {
                refresher.run();
                task.complete(null);
            } catch (Throwable error) {
                task.completeExceptionally(error);
                if (error instanceof Error seriousError) {
                    throw seriousError;
                }
            } finally {
                inFlightTasks.remove(key, task);
            }
        });
        return TriggerOutcome.EXECUTED;
    }
}
