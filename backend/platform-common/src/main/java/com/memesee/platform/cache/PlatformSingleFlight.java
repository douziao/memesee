package com.memesee.platform.cache;

import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Supplier;

public final class PlatformSingleFlight {

    private final ConcurrentMap<String, CompletableFuture<Object>> inFlightTasks = new ConcurrentHashMap<>();

    public <T> T execute(String key, Supplier<T> loader) {
        return execute(key, loader, null);
    }

    public <T> T execute(String key, Supplier<T> loader, Runnable onJoin) {
        Objects.requireNonNull(loader, "loader must not be null");
        if (key == null || key.isBlank()) {
            return loader.get();
        }

        CompletableFuture<Object> task = new CompletableFuture<>();
        CompletableFuture<Object> existingTask = inFlightTasks.putIfAbsent(key, task);
        if (existingTask == null) {
            try {
                T value = loader.get();
                task.complete(value);
                return value;
            } catch (Throwable error) {
                task.completeExceptionally(error);
                if (error instanceof RuntimeException runtimeException) {
                    throw runtimeException;
                }
                if (error instanceof Error seriousError) {
                    throw seriousError;
                }
                throw new IllegalStateException("single-flight loader failed", error);
            } finally {
                inFlightTasks.remove(key, task);
            }
        }

        if (onJoin != null) {
            onJoin.run();
        }
        return await(existingTask);
    }

    @SuppressWarnings("unchecked")
    private <T> T await(CompletableFuture<Object> task) {
        try {
            return (T) task.join();
        } catch (CompletionException error) {
            Throwable cause = error.getCause();
            if (cause instanceof RuntimeException runtimeException) {
                throw runtimeException;
            }
            if (cause instanceof Error seriousError) {
                throw seriousError;
            }
            throw error;
        }
    }
}
