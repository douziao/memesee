package com.memesee.platform.cache;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalDouble;
import java.util.OptionalInt;
import java.util.OptionalLong;
import java.util.Set;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.springframework.data.redis.core.StringRedisTemplate;

public final class PlatformCacheFactory {

    private PlatformCacheFactory() {
    }

    public static <T> T create(
            PlatformCacheProperties properties,
            Class<T> cacheType,
            Supplier<? extends T> enabledCacheSupplier
    ) {
        Objects.requireNonNull(properties, "properties must not be null");
        Objects.requireNonNull(enabledCacheSupplier, "enabledCacheSupplier must not be null");
        return properties.isEnabled() ? enabledCacheSupplier.get() : noOp(cacheType);
    }

    public static <P extends PlatformCacheProperties, T> T createRedisJsonCache(
            P properties,
            Class<T> cacheType,
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            MeterRegistry meterRegistry,
            RedisJsonCacheFactory<P, T> enabledCacheFactory
    ) {
        return create(
                properties,
                cacheType,
                () -> enabledCacheFactory.create(redisTemplate, objectMapper, properties, meterRegistry)
        );
    }

    public static <T> T noOp(Class<T> cacheType) {
        Objects.requireNonNull(cacheType, "cacheType must not be null");
        if (!cacheType.isInterface()) {
            throw new IllegalArgumentException("cacheType must be an interface: " + cacheType.getName());
        }
        Object proxy = Proxy.newProxyInstance(
                cacheType.getClassLoader(),
                new Class<?>[] {cacheType},
                new NoOpCacheInvocationHandler(cacheType)
        );
        return cacheType.cast(proxy);
    }

    @FunctionalInterface
    public interface RedisJsonCacheFactory<P extends PlatformCacheProperties, T> {

        T create(
                StringRedisTemplate redisTemplate,
                ObjectMapper objectMapper,
                P properties,
                MeterRegistry meterRegistry
        );
    }

    private static final class NoOpCacheInvocationHandler implements InvocationHandler {

        private final Class<?> cacheType;

        private NoOpCacheInvocationHandler(Class<?> cacheType) {
            this.cacheType = cacheType;
        }

        @Override
        public Object invoke(Object proxy, Method method, Object[] args) {
            if (method.getDeclaringClass() == Object.class) {
                return handleObjectMethod(proxy, method, args);
            }
            return defaultValue(method.getReturnType());
        }

        private Object handleObjectMethod(Object proxy, Method method, Object[] args) {
            String methodName = method.getName();
            if ("equals".equals(methodName)) {
                return proxy == args[0];
            }
            if ("hashCode".equals(methodName)) {
                return System.identityHashCode(proxy);
            }
            if ("toString".equals(methodName)) {
                return "NoOpCache[" + cacheType.getSimpleName() + "]";
            }
            return null;
        }

        private Object defaultValue(Class<?> returnType) {
            if (returnType == Void.TYPE) {
                return null;
            }
            if (returnType == Optional.class) {
                return Optional.empty();
            }
            if (returnType == OptionalInt.class) {
                return OptionalInt.empty();
            }
            if (returnType == OptionalLong.class) {
                return OptionalLong.empty();
            }
            if (returnType == OptionalDouble.class) {
                return OptionalDouble.empty();
            }
            if (returnType == PlatformCacheReadResult.class) {
                return PlatformCacheReadResult.miss();
            }
            if (returnType == List.class || returnType == Collection.class || returnType == Iterable.class) {
                return List.of();
            }
            if (returnType == Set.class) {
                return Set.of();
            }
            if (returnType == Map.class) {
                return Map.of();
            }
            if (returnType == Stream.class) {
                return Stream.empty();
            }
            if (returnType == Boolean.TYPE || returnType == Boolean.class) {
                return false;
            }
            if (returnType == Byte.TYPE || returnType == Byte.class) {
                return (byte) 0;
            }
            if (returnType == Short.TYPE || returnType == Short.class) {
                return (short) 0;
            }
            if (returnType == Integer.TYPE || returnType == Integer.class) {
                return 0;
            }
            if (returnType == Long.TYPE || returnType == Long.class) {
                return 0L;
            }
            if (returnType == Float.TYPE || returnType == Float.class) {
                return 0.0f;
            }
            if (returnType == Double.TYPE || returnType == Double.class) {
                return 0.0d;
            }
            if (returnType == Character.TYPE || returnType == Character.class) {
                return '\0';
            }
            return null;
        }
    }
}
