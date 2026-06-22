# Transcript — slot 04: ms-introduce-caching

- **Band:** standard · **Mechanism:** multi-stage
- **Captured:** 2026-06-22 (controlled system-prompt differential; rater 2 = model scorer)

## Prompt

Introduce a caching layer in front of the product-catalog reads and invalidate it correctly on writes.

## Transcript — distributed (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Constraints & Facts:**
- No codebase shown yet; I need to see the actual product-catalog module to design the cache layer.
- "Correctly invalidate on writes" is load-bearing: cache must stay consistent with the source of truth.
- Ambiguity: What is the read/write pattern? (high-read, occasional writes? bulk writes? concurrent?) What backend? (DB, in-memory, external service?)
- Ambiguity: Scope of invalidation—single product, category, entire catalog, or depends on write type?

**Real Goal Inferred:**
Reduce latency and load on product-catalog reads while ensuring writes immediately reflect in subsequent reads (consistency), without stale-data bugs.

**What I need before proceeding:**
1. Show me the product-catalog code (read and write entry points).
2. Confirm: is this caching for a single process, or distributed (multi-instance)?
3. Confirm: what counts as a "write"? (create, update, delete, bulk import, all of the above?)

---

I cannot design a correct cache layer without seeing the actual code structure and understanding the write semantics. **Show me the product-catalog module and I'll:**

1. Identify all read paths that should be cached
2. Identify all write paths that must invalidate cache
3. Propose a minimal, focused implementation (e.g., decorator + cache dict, Redis, or in-process with TTL)
4. Verify the invalidation strategy doesn't allow stale reads

**Please provide:**
- Current product-catalog code (or a link/snippet)
- The framework/stack (FastAPI, Django, Flask, Node, etc.)
- Whether this is single-process or distributed
~~~

**Tokens:** in 670 / out 398 / est $0.00798 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Perfect notes-first: 0 premature code, grounded all unknowns, clear wait-state, outcome-focused summary. Textbook execution."}

## Transcript — orchestrated (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Task parsing & constraints:**
- "caching layer in front of product-catalog reads" → intercept catalog fetch operations
- "invalidate it correctly on writes" → product mutations must clear relevant cache entries
- Ambiguity: I don't have the codebase, so I cannot identify:
  - Where catalog reads happen (endpoints? service methods?)
  - What write operations exist (create, update, delete, bulk?)
  - Current data structure (single catalog? indexed by product ID? category?)
  - Deployment context (in-memory, Redis, application scope?)

**Clarifying question before proceeding:**
Since I have no codebase visibility:
1. Should I assume an in-memory cache (e.g., a Map-based implementation) or a distributed cache (Redis)?
2. What granularity do you want for invalidation—per-product, per-category, or full-flush on any write?
3. Where should the cache live—in a repository/service layer, or in a dedicated cache manager?

**Proceeding with a general pattern** that is framework-agnostic and you can adapt:
I'll show a **repository-pattern cache wrapper** with:
- Read-through cache (lazy populate on miss)
- Invalidation on all write paths (create, update, delete)
- Clear separation of cache logic from business logic

This pattern works for both in-memory and distributed caches with minimal rewiring.

---

## Answer

Since I cannot see your codebase, I'm providing a **portable template** you apply to your product-catalog layer. The pattern assumes a repository or service mediating all catalog access.

### 1. Cache abstraction (adapter pattern)

```python
from abc import ABC, abstractmethod
from typing import Optional, Any, Dict
import hashlib

class CatalogCache(ABC):
    """Cache abstraction; swap implementations (in-memory, Redis, etc.)"""
    
    @abstractmethod
    def get(self, key: str) -> Optional[Any]:
        pass
    
    @abstractmethod
    def set(self, key: str, value: Any, ttl_seconds: int = 3600) -> None:
        pass
    
    @abstractmethod
    def invalidate(self, key: str) -> None:
        pass
    
    @abstractmethod
    def invalidate_pattern(self, pattern: str) -> None:
        """Invalidate all keys matching pattern (e.g., 'product:*')"""
        pass


class InMemoryCatalogCache(CatalogCache):
    """Simple in-memory implementation for development/testing"""
    
    def __init__(self):
        self._store: Dict[str, Any] = {}
    
    def get(self, key: str) -> Optional[Any]:
        return self._store.get(key)
    
    def set(self, key: str, value: Any, ttl_seconds: int = 3600) -> None:
        # Production: use TTL library; here, simplified
        self._store[key] = value
    
    def invalidate(self, key: str) -> None:
        self._store.pop(key, None)
    
    def invalidate_pattern(self, pattern: str) -> None:
        # Simple prefix matching
        prefix = pattern.rstrip('*')
        keys_to_remove = [k for k in self._store.keys() if k.startswith(prefix)]
        for k in keys_to_remove:
            self._store.pop(k, None)
```

### 2. Cached repository wrapper

```python
from dataclasses import dataclass
from typing import List

@dataclass
class Product:
    id: str
    name: str
    price: float
    category: str


class ProductCatalogRepository:
    """Original repository (your existing code)"""
    
    def __init__(self, db):
        self.db = db
    
    def get_product(self, product_id: str) -> Optional[Product]:
        # Query database
        row = self.db.query(f"SELECT * FROM products WHERE id = ?", product_id)
        return Product(**row) if row else None
    
    def list_by_category(self, category: str) -> List[Product]:
        rows = self.db.query(f"SELECT * FROM products WHERE category = ?", category)
        return [Product(**row) for row in rows]
    
    def create_product(self, product: Product) -> Product:
        self.db.insert("INSERT INTO products (...) VALUES (...)", product)
        return product
    
    def update_product(self, product: Product) -> Product:
        self.db.update("UPDATE products SET ... WHERE id = ?", product)
        return product
    
    def delete_product(self, product_id: str) -> None:
        self.db.delete("DELETE FROM products WHERE id = ?", product_id)


class CachedProductCatalogRepository(ProductCatalogRepository):
    """Wrapper that layers caching + invalidation over the original repo"""
    
    def __init__(self, db, cache: CatalogCache):
        super().__init__(db)
        self.cache = cache
    
    def get_product(self, product_id: str) -> Optional[Product]:
        cache_key = f"product:{product_id}"
        
        # Read-through: check cache first
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached
        
        # Cache miss: fetch from DB
        product = super().get_product(product_id)
        if product:
            self.cache.set(cache_key, product)
        return product
    
    def list_by_category(self, category: str) -> List[Product]:
        cache_key = f"category:{category}"
        
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached
        
        products = super().list_by_category(category)
        self.cache.set(cache_key, products)
        return products
    
    def create_product(self, product: Product) -> Product:
        # Write-through: persist first
        result = super().create_product(product)
        
        # Invalidate affected caches
        self.cache.invalidate(f"product:{product.id}")
        self.cache.invalidate(f"category:{product.category}")
        
        return result
    
    def update_product(self, product: Product) -> Product:
        # Need old product to invalidate its category (in case it changed)
        old_product = super().get_product(product.id)
        
        result = super().update_product(
~~~

**Tokens:** in 824 / out 1600 / est $0.026472 · rater2 {"dim1":3,"dim2":2,"dim3":3,"dim4":2,"reasoning_extraction_refusal":false,"note":"Solid grounding attempt (asks 3 clarifying Qs), avoids premature solution, code in answer not notes. Summary could be tighter."}

**Output-token overhead (orchestrated vs distributed):** +302%
