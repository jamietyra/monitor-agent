// ─── Wilson — AI Companion Character ──────────────────
(function() {
  'use strict';

  // ─── Constants ───────────────────────────────────────
  var WAIT_TIMEOUT = 5000;
  var SLEEP_TIMEOUT = 600000;
  var TIP_DISPLAY_TIME = 15000;
  var ACTION_LINGER_TIME = 15000;
  var MAX_RECENT_FILES = 100;

  // ─── SVGs (5 states) ────────────────────────────────
  var SVG_START = '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wilson character">' +
    '<title>Wilson</title>' +
    '<circle cx="24" cy="24" r="22" fill="#f0ebe0" stroke="#d8d0c4" stroke-width="0.8"/>' +
    '<line x1="3" y1="16" x2="45" y2="16" stroke="#ccc4b8" stroke-width="0.5"/>' +
    '<line x1="3" y1="33" x2="45" y2="33" stroke="#ccc4b8" stroke-width="0.5"/>' +
    '<path d="M11 14 C9 9 13 5 17 7 C19 4 22 3 25 5 C27 3 31 4 33 7 C36 5 40 9 37 14 C41 18 43 24 41 31 C39 38 33 44 24 44 C15 44 9 38 7 31 C5 24 7 18 11 14 Z" fill="#8B1A1A"/>';
  var SVG_END = '<circle cx="24" cy="28" r="1" fill="white" opacity="0.25"/>' +
    '<path d="M18 35 Q24 39 30 35" fill="none" stroke="white" stroke-width="1" opacity="0.35" stroke-linecap="round"/>' +
    '</svg>';

  // Eyes: normal (centered pupils)
  var EYES_NORMAL =
    '<path d="M12 19 Q14 14 19 16 Q22 18 20 23 Q17 26 13 23 Q11 21 12 19 Z" fill="white" opacity="0.9"/>' +
    '<circle cx="16" cy="20" r="2" fill="#1a1a2e"/>' +
    '<path d="M28 16 Q33 14 36 19 Q37 22 35 24 Q31 27 28 23 Q26 19 28 16 Z" fill="white" opacity="0.9"/>' +
    '<circle cx="32" cy="20" r="2" fill="#1a1a2e"/>';
  // Eyes: looking up (thinking)
  var EYES_UP =
    '<path d="M12 19 Q14 14 19 16 Q22 18 20 23 Q17 26 13 23 Q11 21 12 19 Z" fill="white" opacity="0.9"/>' +
    '<circle cx="17" cy="18" r="2" fill="#1a1a2e"/>' +
    '<path d="M28 16 Q33 14 36 19 Q37 22 35 24 Q31 27 28 23 Q26 19 28 16 Z" fill="white" opacity="0.9"/>' +
    '<circle cx="33" cy="18" r="2" fill="#1a1a2e"/>';
  // Eyes: sparkle (solving)
  var EYES_SPARKLE =
    '<path d="M12 19 Q14 14 19 16 Q22 18 20 23 Q17 26 13 23 Q11 21 12 19 Z" fill="white" opacity="0.9"/>' +
    '<circle cx="16" cy="20" r="2" fill="#1a1a2e"/>' +
    '<circle cx="17.5" cy="18" r="1.5" fill="white" opacity="0.95"/>' +
    '<path d="M28 16 Q33 14 36 19 Q37 22 35 24 Q31 27 28 23 Q26 19 28 16 Z" fill="white" opacity="0.9"/>' +
    '<circle cx="32" cy="20" r="2" fill="#1a1a2e"/>' +
    '<circle cx="33.5" cy="18" r="1.5" fill="white" opacity="0.95"/>';
  // Eyes: closed (sleeping)
  var EYES_CLOSED =
    '<path d="M13 21 Q16 23 20 21" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>' +
    '<path d="M28 21 Q31 23 35 21" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>';

  var SVGS = {
    waiting:  SVG_START + EYES_NORMAL + SVG_END,
    thinking: SVG_START + EYES_NORMAL + SVG_END,  // 동공 위치는 JS가 실시간 변경
    working:  SVG_START + EYES_NORMAL + SVG_END,
    solving:  SVG_START + EYES_SPARKLE + SVG_END,
    sleeping: SVG_START + EYES_CLOSED + SVG_END
  };

  // 배구공 뒷면 (5줄 곡선 솔기 + 3D 음영 + Wilson 로고)
  var SVG_BACK = '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
    '<defs>' +
      '<radialGradient id="ballShade" cx="35%" cy="30%" r="70%">' +
        '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.5"/>' +
        '<stop offset="55%" stop-color="#ffffff" stop-opacity="0"/>' +
        '<stop offset="100%" stop-color="#000000" stop-opacity="0.25"/>' +
      '</radialGradient>' +
    '</defs>' +
    '<circle cx="24" cy="24" r="22" fill="#f0ebe0" stroke="#d8d0c4" stroke-width="0.8"/>' +
    '<circle cx="24" cy="24" r="22" fill="url(#ballShade)"/>' +
    // 5 curved seam lines
    '<path d="M5 13 Q24 10 43 13" fill="none" stroke="#b8b0a4" stroke-width="0.6"/>' +
    '<path d="M3 19 Q24 17 45 19" fill="none" stroke="#b8b0a4" stroke-width="0.6"/>' +
    '<path d="M2 25 Q24 24 46 25" fill="none" stroke="#b8b0a4" stroke-width="0.6"/>' +
    '<path d="M3 31 Q24 33 45 31" fill="none" stroke="#b8b0a4" stroke-width="0.6"/>' +
    '<path d="M5 37 Q24 40 43 37" fill="none" stroke="#b8b0a4" stroke-width="0.6"/>' +
    '</svg>';

  // ─── JS Animations (requestAnimationFrame) ───────────
  var animFrame = null;

  function animate(state) {
    if (animFrame) cancelAnimationFrame(animFrame);
    // solving에서 설정한 inline filter를 다른 상태 진입 시 클리어
    if (state !== 'solving' && svgWrap) svgWrap.style.filter = '';
    var start = performance.now();
    function tick(now) {
      // Wilson 영역이 숨겨지면 애니메이션 중단 (CPU 절약)
      if (!svgWrap.offsetParent) {
        animFrame = null;
        return;
      }
      var t = now - start;
      var s, r;
      switch (state) {
        case 'waiting':   // 4s breathing (속도 절반)
          s = 1 + 0.04 * Math.sin(t * Math.PI * 2 / 4000);
          svgWrap.style.transform = 'scale(' + s + ')';
          svgWrap.style.opacity = '';
          break;
        case 'thinking':  // 눈동자 회전 + 약한 흔들림
          r = 3 * Math.sin(t * Math.PI * 2 / 800);
          var ang = t / 600 * Math.PI * 2;
          var dx = 2 * Math.cos(ang);
          var dy = 2 * Math.sin(ang);
          // pupils는 thinking 진입 시 cache됨 (svgWrap._pupils)
          if (svgWrap._pupils && svgWrap._pupils.length >= 2) {
            svgWrap._pupils[0].setAttribute('cx', 16 + dx);
            svgWrap._pupils[0].setAttribute('cy', 20 + dy);
            svgWrap._pupils[1].setAttribute('cx', 32 + dx);
            svgWrap._pupils[1].setAttribute('cy', 20 + dy);
          }
          svgWrap.style.transform = 'rotate(' + r + 'deg)';
          svgWrap.style.opacity = '';
          break;
        case 'working':   // Y축 자전 (속도 30%, 뒷면 빈 공)
          r = (t % 1700) / 1700 * 360;
          var showBack = (r > 90 && r < 270);
          var needed = showBack ? 'back' : 'front';
          if (svgWrap._face !== needed) {
            svgWrap.innerHTML = showBack ? SVG_BACK : SVGS.working;
            svgWrap._face = needed;
          }
          svgWrap.style.transform = 'perspective(300px) rotateY(' + r + 'deg)';
          svgWrap.style.opacity = '';
          break;
        case 'solving':   // 황금 오로라 발광 (1s)
          s = 1 + 0.05 * Math.sin(t * Math.PI * 2 / 1000);
          var glow = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 1000);
          var blur1 = 4 + 14 * glow;
          var blur2 = 10 + 24 * glow;
          var alpha = 0.4 + 0.5 * glow;
          svgWrap.style.transform = 'scale(' + s + ')';
          svgWrap.style.filter =
            'drop-shadow(0 0 ' + blur1 + 'px rgba(255, 215, 80, ' + alpha + ')) ' +
            'drop-shadow(0 0 ' + blur2 + 'px rgba(255, 180, 50, ' + (alpha * 0.7) + '))';
          svgWrap.style.opacity = '';
          break;
        case 'sleeping':  // 5s slow breathe
          s = 1 + 0.02 * Math.sin(t * Math.PI * 2 / 5000);
          svgWrap.style.transform = 'scale(' + s + ')';
          svgWrap.style.opacity = '0.6';
          break;
      }
      animFrame = requestAnimationFrame(tick);
    }
    animFrame = requestAnimationFrame(tick);
  }

  // ─── Tips (500 fundamental concepts, EN) ─────────────
  var TIPS = [
    "Everything in memory is bits",
    "8 bits equals 1 byte",
    "1 KB is 1024 bytes, not 1000",
    "Integer overflow wraps around silently",
    "Floating point cannot represent 0.1 exactly",
    "NaN is never equal to itself",
    "null and undefined are different concepts",
    "Arrays are contiguous in memory",
    "Linked lists trade space for flexibility",
    "Hash tables give O(1) average lookup",
    "Worst case hash collision is O(n)",
    "Trees represent hierarchy",
    "Graphs represent relationships",
    "Stacks follow last-in-first-out (LIFO)",
    "Queues follow first-in-first-out (FIFO)",
    "Recursion is a function calling itself",
    "Every recursion needs a base case",
    "Stack overflow comes from too-deep recursion",
    "Tail calls can be optimized to loops",
    "Binary search requires sorted data",
    "Binary search runs in O(log n)",
    "Linear search runs in O(n)",
    "Bubble sort is O(n^2) and rarely used",
    "Quicksort averages O(n log n)",
    "Mergesort is always O(n log n)",
    "Sorting algorithms have different tradeoffs",
    "Time complexity measures runtime growth",
    "Space complexity measures memory growth",
    "Big O describes worst case",
    "Big theta describes a tight bound",
    "Pointers store memory addresses",
    "Dereferencing accesses the pointed value",
    "Dangling pointers point to freed memory",
    "Memory leaks happen when memory is not freed",
    "Garbage collection automates memory management",
    "Reference counting tracks pointer counts",
    "Mark-and-sweep walks reachable objects",
    "Stack memory is faster than heap",
    "Stack size is limited per thread",
    "Heap allocation has overhead",
    "Buffer overflow writes past allocated memory",
    "Null pointer dereference crashes programs",
    "Use-after-free corrupts memory",
    "Race conditions happen with shared state",
    "Deadlock requires circular resource waiting",
    "Mutex serializes access to resources",
    "Semaphore counts available resources",
    "Atomic operations cannot be interrupted",
    "Volatile prevents certain compiler optimizations",
    "Threads share memory; processes do not",
    "Context switches are expensive",
    "A word is typically 32 or 64 bits",
    "Endianness is byte order in memory",
    "Little-endian is most common today",
    "Big-endian is network byte order",
    "UTF-8 uses 1 to 4 bytes per character",
    "UTF-8 is backward compatible with ASCII",
    "ASCII covers 128 characters",
    "Unicode has over a million code points",
    "Naive string concatenation in loops can be O(n^2)",
    "Use a StringBuilder for many joins",
    "Regex can be slow with catastrophic backtracking",
    "Regex greedy matching takes the longest match",
    "Compile regex once when reused",
    "Lookahead extends matches without consuming",
    "Anchors match positions, not characters",
    "Mutable state is a source of bugs",
    "Immutable data is easier to reason about",
    "Pure functions have no side effects",
    "Side effects include IO, mutation, exceptions",
    "Higher-order functions take or return functions",
    "Closures capture their enclosing scope",
    "Lexical scope is determined at write time",
    "Dynamic scope is determined at call time",
    "Hoisting moves declarations to the top",
    "Block scope is limited to braces",
    "Global scope pollutes the namespace",
    "Primitives are copied by value",
    "Objects are passed by reference",
    "Equality differs for primitives and objects",
    "Identity compares memory addresses",
    "Deep equality checks all nested values",
    "Shallow copy copies the top level only",
    "Deep copy clones everything recursively",
    "Prefer returning new values over mutating",
    "Frozen objects prevent modification",
    "Getters run on property access",
    "Setters run on property assignment",
    "Proxies intercept operations on objects",
    "Prototypes delegate property lookup",
    "Classes are sugar over prototypes",
    "Inheritance creates tight coupling",
    "Composition is usually preferred to inheritance",
    "Abstract classes cannot be instantiated",
    "Interfaces define contracts without implementation",
    "Polymorphism means one name, many behaviors",
    "A linked list is a chain of nodes",
    "A doubly linked list has next and previous pointers",
    "A circular list wraps back to the head",
    "A deque allows insertion at both ends",
    "A priority queue dequeues the highest priority",
    "A binary tree has at most two children per node",
    "A balanced binary tree has logarithmic depth",
    "A BST keeps left less than root less than right",
    "AVL trees are self-balancing BSTs",
    "Red-black trees are also self-balancing BSTs",
    "B-trees are used in databases and filesystems",
    "Tries store strings efficiently by prefix",
    "A heap is a tree where parents dominate children",
    "A min-heap keeps the smallest at the root",
    "A max-heap keeps the largest at the root",
    "Hash tables use hash functions to map keys",
    "Collision resolution uses chaining or open addressing",
    "Load factor is entries divided by capacity",
    "Resizing rehashes all entries at cost",
    "A set is a collection with no duplicates",
    "A bloom filter probabilistically checks membership",
    "Bloom filters can have false positives, not negatives",
    "Skip lists add layers for faster traversal",
    "Graphs can be directed or undirected",
    "Graphs can be weighted or unweighted",
    "An adjacency matrix uses O(V^2) space",
    "An adjacency list suits sparse graphs",
    "DFS goes deep before going wide",
    "BFS goes wide before going deep",
    "Dijkstra finds shortest paths with non-negative weights",
    "Bellman-Ford handles negative weights",
    "Floyd-Warshall finds all-pairs shortest paths",
    "A* uses heuristics to speed up pathfinding",
    "Topological sort orders DAG nodes",
    "A minimum spanning tree connects all nodes minimally",
    "Union-find tracks connected components efficiently",
    "Dynamic programming avoids recomputing subproblems",
    "Memoization caches function results",
    "Tabulation builds solutions bottom-up",
    "Greedy algorithms pick locally optimal choices",
    "Greedy is not always globally optimal",
    "Divide and conquer splits problems recursively",
    "NP problems have solutions verifiable in polynomial time",
    "Backtracking explores possibilities and prunes failures",
    "Good hashes distribute keys evenly",
    "Cryptographic hashes are one-way",
    "MD5 and SHA-1 are no longer secure",
    "SHA-256 is currently considered secure",
    "Bcrypt is for password hashing",
    "Argon2 is modern and memory-hard",
    "Salt prevents rainbow table attacks",
    "HMAC combines a hash with a secret key",
    "Base64 encoding is not encryption",
    "URL encoding replaces unsafe characters",
    "A checksum detects transmission errors",
    "Compression removes redundancy",
    "Lossless compression preserves all data",
    "Lossy compression trades fidelity for size",
    "Gzip combines LZ77 with Huffman coding",
    "Brotli often compresses better than gzip",
    "Encapsulation hides internal state",
    "Abstraction exposes essential features",
    "Inheritance shares code between related classes",
    "Liskov substitution keeps subtype behavior compatible",
    "Single responsibility limits a class's reasons to change",
    "Open-closed favors extension over modification",
    "Interface segregation prevents fat interfaces",
    "Dependency inversion depends on abstractions",
    "Don’t repeat yourself reduces duplication",
    "KISS keeps things simple",
    "YAGNI skips speculative features",
    "Premature optimization is the root of much evil",
    "Code for readability first",
    "Magic numbers should become named constants",
    "Functions should do one thing well",
    "Short functions are easier to understand",
    "Descriptive names beat comments",
    "Comments should explain why, not what",
    "Dead code accumulates and confuses readers",
    "Commented-out code should be deleted (Git remembers)",
    "Boolean arguments often signal design smells",
    "Stringly-typed APIs are fragile",
    "Primitive obsession uses raw types for domain data",
    "Feature envy suggests methods belong elsewhere",
    "Data clumps should become objects",
    "Long parameter lists suggest extract-object",
    "Speculative generality creates unused flexibility",
    "Message chains couple callers to structure",
    "Factory pattern centralizes object creation",
    "Singleton gives one instance and is often overused",
    "Observer pattern broadcasts events",
    "Strategy pattern swaps algorithms at runtime",
    "Decorator pattern adds behavior transparently",
    "Adapter pattern bridges incompatible interfaces",
    "Facade pattern simplifies complex subsystems",
    "Proxy pattern controls access to an object",
    "Template method defines an algorithm skeleton",
    "Command pattern wraps actions as objects",
    "State pattern changes behavior with state",
    "Iterator pattern walks collections uniformly",
    "Builder constructs complex objects step by step",
    "MVC separates model, view, and controller",
    "MVVM binds view to view-model",
    "Hexagonal architecture uses ports and adapters",
    "Domain-driven design models the problem space",
    "Bounded contexts separate subsystem models",
    "Entities have identity and lifecycle",
    "Value objects are compared by data",
    "Aggregates enforce consistency boundaries",
    "Repositories provide collection-like access",
    "CQRS separates reads from writes",
    "Event sourcing stores changes as events",
    "Git tracks snapshots, not diffs",
    "Every commit has a unique SHA",
    "Branches are pointers to commits",
    "HEAD points to the current branch or commit",
    "Merging combines branch histories",
    "Fast-forward is a clean forward move",
    "Rebase reapplies commits on a new base",
    "Rebase rewrites history; avoid on shared branches",
    "Squash combines commits into one",
    "Cherry-pick copies specific commits",
    "Reflog records HEAD movements",
    "Stash saves work in progress temporarily",
    "Bisect finds regressions by binary search",
    ".gitignore excludes files from tracking",
    "Submodules include external repos",
    "Shallow clones download partial history",
    "Detached HEAD is not on a branch",
    "Reset --hard discards uncommitted changes",
    "Revert creates a new inverse commit",
    "HTTP is stateless by default",
    "Cookies add state to HTTP",
    "JWT is a signed token carrying claims",
    "OAuth delegates authorization, not authentication",
    "OpenID Connect adds authentication to OAuth",
    "HTTPS encrypts HTTP with TLS",
    "TLS provides confidentiality and integrity",
    "Certificates authenticate servers via chains of trust",
    "2xx means success, 3xx redirects",
    "4xx is a client error, 5xx is a server error",
    "200 OK is the standard success response",
    "201 Created signals resource creation",
    "204 No Content means success without body",
    "301 Moved Permanently redirects with caching",
    "302 Found redirects without permanence",
    "304 Not Modified signals cache validity",
    "400 Bad Request means invalid input",
    "401 Unauthorized means not authenticated",
    "403 Forbidden means not authorized",
    "404 Not Found means the resource is absent",
    "409 Conflict means state collision",
    "422 is for validation errors",
    "429 Too Many Requests signals rate limiting",
    "500 is a generic server failure",
    "502 Bad Gateway means an upstream problem",
    "503 Service Unavailable means overload",
    "504 Gateway Timeout means upstream took too long",
    "REST uses HTTP verbs for actions",
    "GET should be safe and idempotent",
    "POST creates or performs side effects",
    "PUT replaces a resource",
    "PATCH partially updates a resource",
    "DELETE removes a resource",
    "OPTIONS describes allowed methods",
    "Idempotent operations can be repeated safely",
    "GraphQL lets clients choose fields",
    "gRPC uses HTTP/2 and Protobuf",
    "WebSockets enable full-duplex communication",
    "Server-sent events push data to clients",
    "CORS restricts cross-origin requests",
    "Same-origin policy limits JavaScript reach",
    "Content Security Policy mitigates XSS",
    "XSS injects malicious scripts into pages",
    "CSRF tricks users into unintended actions",
    "SQL injection embeds SQL in unsafe queries",
    "Parameterized queries prevent SQL injection",
    "Clickjacking overlays invisible frames",
    "HSTS forces HTTPS for a domain",
    "Cookies should be HttpOnly when possible",
    "Secure cookies are sent only over HTTPS",
    "SameSite cookies limit cross-site sending",
    "Rate limiting protects against abuse",
    "MFA adds a second authentication factor",
    "TOTP generates time-based codes",
    "WebAuthn uses public-key cryptography",
    "CDNs cache static assets near users",
    "DNS maps names to IP addresses",
    "TTL controls how long DNS is cached",
    "A records map names to IPv4 addresses",
    "AAAA records map names to IPv6 addresses",
    "CNAME records alias one name to another",
    "MX records route email",
    "SPF, DKIM, and DMARC authenticate email origin",
    "TCP is reliable and ordered",
    "UDP is faster but unreliable",
    "The three-way handshake starts a TCP connection",
    "NAT maps private IPs to public ones",
    "Load balancers distribute traffic",
    "Round robin cycles through backends",
    "Least connections sends to the least busy",
    "Consistent hashing routes stably",
    "Health checks remove unhealthy nodes",
    "Circuit breakers stop calling failing services",
    "Retries should use exponential backoff",
    "Backoff with jitter prevents thundering herds",
    "Timeouts bound bad upstream behavior",
    "Idempotency keys prevent duplicate effects",
    "ACID guarantees reliable transactions",
    "Atomicity: transactions fully commit or not at all",
    "Consistency: transactions preserve invariants",
    "Isolation: concurrent transactions appear serial",
    "Durability: committed data survives failures",
    "CAP: you cannot have all of C, A, and P at once",
    "Indexes speed up reads but slow writes",
    "A B-tree index supports range queries",
    "Hash indexes support equality lookups",
    "Composite indexes match leading columns first",
    "Query plans show how a DB runs a query",
    "EXPLAIN reveals the plan",
    "Normalization reduces duplication",
    "1NF requires atomic columns",
    "2NF eliminates partial dependencies",
    "3NF eliminates transitive dependencies",
    "Denormalization trades redundancy for speed",
    "Foreign keys enforce referential integrity",
    "NULL means unknown, not zero or empty",
    "JOIN combines rows from multiple tables",
    "LEFT JOIN keeps all left rows",
    "INNER JOIN keeps only matching rows",
    "UNION combines results without duplicates",
    "UNION ALL keeps duplicates and is faster",
    "Window functions compute over row partitions",
    "CTEs name temporary result sets",
    "Read committed avoids dirty reads",
    "Repeatable read avoids non-repeatable reads",
    "Serializable is the strictest isolation",
    "Snapshot isolation uses MVCC",
    "Optimistic locking checks versions on commit",
    "Pessimistic locking blocks other writers",
    "Replication copies data to replicas",
    "Sharding splits data across nodes",
    "Eventual consistency converges given time",
    "Strong consistency reads the latest writes",
    "Read replicas can have replication lag",
    "Connection pools reuse database connections",
    "N+1 queries hurt performance",
    "Batch queries to reduce round trips",
    "Caching avoids recomputation",
    "Cache invalidation is one of the hard problems",
    "Cache-aside lets apps manage caching",
    "Write-through keeps cache and DB in sync",
    "Write-back delays DB writes for throughput",
    "TTL expires cache entries",
    "LRU evicts least recently used entries",
    "LFU evicts least frequently used entries",
    "Tests should be fast, isolated, and repeatable",
    "Unit tests exercise small pieces in isolation",
    "Integration tests check component interactions",
    "End-to-end tests exercise the whole system",
    "TDD writes tests before implementation",
    "Red-green-refactor is the TDD cycle",
    "Mocks replace dependencies with fakes",
    "Stubs return canned responses",
    "Fakes have working but simplified behavior",
    "Fixtures set up known state for tests",
    "Snapshot tests compare against saved outputs",
    "Property-based tests generate inputs",
    "Fuzz testing finds edge cases randomly",
    "Code coverage measures tested lines",
    "High coverage does not guarantee quality",
    "Flaky tests erode trust in CI",
    "Tests should run in any order",
    "Tests should not share mutable state",
    "Profile before optimizing",
    "Big O matters when n is large",
    "Constant factors matter when n is small",
    "Amortized analysis averages over sequences",
    "Memoize expensive pure functions",
    "Use the right data structure for access patterns",
    "Hash maps for lookups",
    "Arrays for indexed access",
    "Linked lists for frequent insertion and deletion",
    "Trees for ordered data",
    "Heaps for top-k and priority",
    "Lazy evaluation defers work until needed",
    "Streaming processes data without loading it all",
    "Code reviews catch bugs and spread knowledge",
    "Write code for humans, not just machines",
    "Small PRs are easier to review and merge",
    "Commit messages tell future you what you did",
    "Write down what you learn; it compounds",
    "Rubber ducking externalizes your thinking",
    "Deliberate practice beats volume",
    "Ship small, ship often, learn from users",
    "Code lives in a language; meaning lives in names",
    "Prefer pure over convenient when in doubt",
    "Your first implementation is almost never the final one",
    "Systems tend to grow toward their constraints",
    "The stack remembers; the heap forgets",
    "Duplicates hide behind slightly different names",
    "A failing test is more valuable than a passing one",
    "Coupling and cohesion usually move opposite ways",
    "Most legacy code is code that works but we fear",
    "If tests are hard to write, the design is probably wrong",
    "Boundaries determine what can change freely",
    "Explicit beats implicit for long-lived code",
    "Avoid stringly-typed state machines",
    "The debugger is a teacher",
    "Every bug hides an assumption",
    "Never trust timestamps from remote machines",
    "UTC is the safe default",
    "Time zones are politics, not math",
    "Leap seconds exist and sometimes bite",
    "Daylight saving time is a recurring hazard",
    "Unix time counts seconds since 1970 UTC",
    "Monotonic clocks should be used for durations",
    "Wall clocks can jump backward",
    "Logs are love letters to future you",
    "Log at boundaries, not everywhere",
    "Structured logs are searchable",
    "Correlation IDs tie logs across services",
    "Metrics measure rates, gauges measure levels",
    "Histograms reveal distributions, not just averages",
    "Percentiles describe user experience better than means",
    "Alert on symptoms, not causes",
    "Dashboards should answer a question",
    "Tracing shows where time is spent",
    "Observability is not just monitoring",
    "Healthchecks should check real work",
    "Deployments are features too",
    "Feature flags separate release from deploy",
    "Blue-green deploys swap live traffic",
    "Canary deploys shift a small fraction first",
    "Rollbacks should be faster than rollouts",
    "Backups are only real if you can restore them",
    "Disaster recovery has a plan and a drill",
    "Multi-region adds cost and complexity",
    "A queue smooths bursts between services",
    "At-least-once means handle duplicates",
    "At-most-once means tolerate loss",
    "Exactly-once is usually a myth",
    "Message ordering is harder than it looks",
    "Dead-letter queues capture failures",
    "Saga patterns coordinate long transactions",
    "Two-phase commit is expensive and brittle",
    "Event-driven systems decouple producers and consumers",
    "Backpressure prevents producers from overwhelming consumers",
    "Choose push or pull explicitly, not accidentally",
    "Retries without backoff cause retry storms",
    "Timeouts should always be shorter than the upstream",
    "Bulkheads isolate failures",
    "Shed load before failing",
    "Graceful degradation is better than full failure",
    "Design for failure modes, not just happy paths",
    "Latency kills users before outages do",
    "Measure what you care about, not what is easy",
    "The network is not reliable",
    "Latency is not zero",
    "Bandwidth is not infinite",
    "The network is not secure",
    "Topology does not change—until it does",
    "There is more than one administrator",
    "Transport cost is not zero",
    "The network is not homogeneous",
    "Clocks drift between machines",
    "Byte order matters in binary protocols",
    "Character encoding affects byte length",
    "Streams can be infinite; plan for that",
    "Paging protects you from unbounded results",
    "Idempotent upserts simplify retries",
    "Unique constraints prevent silent duplication",
    "Enums outlive any single release",
    "Migrations should be reversible when possible",
    "Additive schema changes are safer",
    "Backwards compatibility is a contract",
    "Deprecate before removing",
    "API versions should be explicit",
    "Breaking changes deserve a major version",
    "Semantic versioning communicates intent",
    "Locking files stabilizes dependency trees",
    "Reproducible builds save your future self",
    "Pin direct dependencies, resolve transitives",
    "Avoid dependencies you cannot read",
    "Every dependency is a liability over time",
    "Static analysis catches bugs cheaply",
    "Linters enforce consistency, not quality",
    "Type checkers cover what tests do not",
    "Hard-to-test code is usually poorly designed",
    "Favor dependency injection for testability",
    "Side effects should be pushed to the edges",
    "A pure core with an imperative shell is easier to test",
    "Error values beat exceptions for expected failures",
    "Exceptions are for truly exceptional states",
    "Let unrecoverable errors crash visibly",
    "Swallowing exceptions hides bugs",
    "Always log enough to reproduce the error",
    "Avoid silent fallbacks in critical paths",
    "Fail fast, fail loud, fail close to the cause",
    "Validate input at the boundary",
    "Never trust client-provided data",
    "Sanitize on input, escape on output",
    "...",
    "You are doing better than you think"
  ];

  // ─── State ───────────────────────────────────────────
  var currentState = 'waiting';
  var recentFiles = [];
  var bubbleMode = 'idle';
  var waitTimer = null;
  var sleepTimer = null;
  var bubbleTimer = null;
  var dotTimer = null;
  var dotCount = 1;
  var isBatchLoading = false;

  // ─── DOM Refs ────────────────────────────────────────
  var panel = document.getElementById('wilson-panel');
  var svgWrap = document.getElementById('wilson-svg-wrap');
  var bubbleEl = document.getElementById('wilson-bubble');
  var recentListEl = document.getElementById('wilson-recent-list');

  // ─── Init SVG + Status Text ──────────────────────────
  var STATE_TOOLTIPS = {
    waiting:  '대기 중 — 어떤 작업도 진행되지 않음',
    thinking: 'Claude가 prompt를 받았거나 도구를 시작함',
    working:  '도구 실행 완료 또는 AI 응답 생성 중',
    solving:  'tool_error 발생 — 문제 해결 중',
    sleeping: '10분 이상 무활동 — 휴면'
  };
  var statusEl = document.createElement('div');
  statusEl.className = 'wilson-status';
  if (svgWrap && svgWrap.parentNode) {
    svgWrap.parentNode.insertBefore(statusEl, svgWrap);
  }
  if (svgWrap) {
    svgWrap.innerHTML = SVGS.waiting;
    svgWrap.setAttribute('role', 'button');
    svgWrap.setAttribute('tabindex', '0');
    svgWrap.setAttribute('aria-label', 'Wilson — 클릭하면 개발 팁이 나옵니다');
    animate('waiting');
    svgWrap.addEventListener('click', onWilsonClick);
    svgWrap.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onWilsonClick();
      }
    });
  }

  // ─── State Machine ──────────────────────────────────
  function setState(newState) {
    if (currentState === newState) return;
    currentState = newState;
    // Swap SVG
    if (svgWrap && SVGS[newState]) {
      svgWrap.innerHTML = SVGS[newState];
      svgWrap._face = 'front';
      // Cache pupil refs once per SVG swap (thinking 최적화)
      svgWrap._pupils = svgWrap.querySelectorAll('circle[fill="#1a1a2e"]');
    }
    // Start JS animation
    if (svgWrap) animate(newState);
    // Tooltip
    if (statusEl && STATE_TOOLTIPS[newState]) {
      statusEl.title = STATE_TOOLTIPS[newState];
    }
    // Body 클래스 (panel-wide state emphasis)
    document.body.className = document.body.className.replace(/wilson-state-\w+/g, '').trim();
    document.body.classList.add('wilson-state-' + newState);
    // Reset dot
    dotCount = 0;
  }

  // Status text — 차분한 효과 (긴 사용 시간 피로 감소)
  var RAINBOW = ['var(--accent)', 'var(--cyan)', 'var(--green)', 'var(--magenta)'];
  var colorIdx = 0;

  dotTimer = setInterval(function() {
    if (!statusEl) return;
    dotCount = (dotCount % 3) + 1;

    switch (currentState) {
      case 'waiting':
      case 'sleeping':
        statusEl.style.color = 'var(--text-dim)';
        statusEl.textContent = currentState + '.'.repeat(dotCount);
        break;
      case 'working':
        statusEl.style.color = 'var(--yellow)';
        statusEl.textContent = currentState;
        break;
      case 'solving':
        // 단일 크림슨, 미묘한 opacity pulse (깜빡임 제거)
        statusEl.style.color = 'var(--accent)';
        statusEl.style.opacity = (dotCount % 2 === 1) ? '1' : '0.65';
        statusEl.textContent = currentState;
        break;
      case 'thinking':
        statusEl.style.opacity = '1';
        colorIdx = (colorIdx + 1) % RAINBOW.length;
        var word = 'thinking';
        var html = '';
        for (var i = 0; i < word.length; i++) {
          var c = RAINBOW[(i + colorIdx) % RAINBOW.length];
          html += '<span style="color:' + c + '">' + word[i] + '</span>';
        }
        statusEl.innerHTML = html;
        break;
    }
    if (currentState !== 'solving') statusEl.style.opacity = '1';
  }, 2500);  // 1.5s → 2.5s (느리게, 덜 정신없게)

  function resetTimers() {
    clearTimeout(sleepTimer);
    // 상태는 다음 이벤트까지 유지, sleeping만 장시간 무활동 시 전환
    sleepTimer = setTimeout(function() {
      setState('sleeping');
    }, SLEEP_TIMEOUT);
  }

  // ─── Event Handler ──────────────────────────────────
  function onEvent(ev) {
    if (!ev) return;

    // Track files always
    if (ev.filePath) trackFile(ev);

    // Skip state changes during batch (init replay)
    if (isBatchLoading) return;

    resetTimers();
    var type = ev.type;

    // State transitions
    if (type === 'prompt' || type === 'tool_start') {
      setState('thinking');
      if (type === 'tool_start') showAction(ev.name, ev.target);
      return;
    }
    if (type === 'tool_error') {
      setState('solving');
      showAction('Error: ' + (ev.name || ''), ev.target);
      return;
    }
    if (type === 'tool_done') {
      setState('working');
      return;
    }
    if (type === 'assistant_text') {
      setState('waiting');
      return;
    }
  }

  // ─── Speech Bubble ──────────────────────────────────
  function showBubble(text, mode) {
    if (!bubbleEl) return;
    clearTimeout(bubbleTimer);
    bubbleMode = mode;
    var isAction = (mode === 'action');
    bubbleEl.innerHTML = (isAction ? '<span class="action-dot"></span>' : '') +
                         escHtml(text);
    bubbleEl.classList.add('visible');
  }

  function hideBubble() {
    if (!bubbleEl) return;
    bubbleEl.classList.remove('visible');
    bubbleMode = 'idle';
  }

  function showAction(toolName, target) {
    var text = toolName || '';
    if (target) {
      var fileName = target.split(/[/\\]/).pop();
      text += ': ' + fileName;
    }
    if (text.length > 40) text = text.slice(0, 37) + '...';
    showBubble(text, 'action');
  }

  function onWilsonClick() {
    // Wobble
    if (panel) {
      panel.classList.add('wilson-wobble');
      setTimeout(function() { panel.classList.remove('wilson-wobble'); }, 500);
    }
    // 언제든 팁 표시 (action 중에도 덮어쓰기)
    var tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    showBubble(tip, 'tip');
  }

  // ─── Recent Files ───────────────────────────────────
  function trackFile(ev) {
    if (!ev.filePath) return;
    var fileName = ev.target || ev.filePath.split(/[/\\]/).pop();
    var action;
    if (ev.fileAction === 'delete' || ev.fileAction === 'move') {
      // file_action 이벤트 (Bash rm/mv, MCP move_file 등)
      action = ev.fileAction;
    } else {
      // 일반 tool_start (Read/Write/Edit)
      action = 'read';
      var name = (ev.name || '').toLowerCase();
      if (/write|create/.test(name)) action = 'write';
      else if (/edit/.test(name)) action = 'edit';
    }

    var diffData = null;
    if (ev.diff) {
      diffData = { filePath: ev.filePath, fileName: fileName, diff: ev.diff, time: ev.time };
    }

    // Dedupe by filePath — move to top, preserve existing diffData if new one is null
    var existing = null;
    recentFiles = recentFiles.filter(function(f) {
      if (f.filePath === ev.filePath) { existing = f; return false; }
      return true;
    });
    recentFiles.unshift({
      filePath: ev.filePath,
      fileName: fileName,
      action: action === 'delete' || action === 'move' ? action : (diffData ? 'edit' : action),
      time: ev.time,
      diffData: diffData || (existing && existing.diffData) || null,
      isDeleted: action === 'delete'
    });
    // 시간순 정렬 (최신이 위)
    recentFiles.sort(function(a, b) {
      return (a.time || '') > (b.time || '') ? 1 : (a.time || '') < (b.time || '') ? -1 : 0;
    });
    if (recentFiles.length > MAX_RECENT_FILES) recentFiles.length = MAX_RECENT_FILES;

    if (!isBatchLoading) renderRecentFiles();
  }

  function renderRecentFiles() {
    if (!recentListEl) return;
    if (recentFiles.length === 0) {
      recentListEl.innerHTML = '<div class="wilson-file-empty">아직 파일 이벤트가 없습니다<br><small>Claude Code가 Read/Write/Edit 할 때 여기 쌓입니다</small></div>';
      return;
    }
    var html = '';
    for (var i = 0; i < recentFiles.length; i++) {
      var f = recentFiles[i];
      var timeStr = f.time && window.formatTime ? window.formatTime(f.time) : '';
      var icon = f.action === 'edit' ? '\u270E'
        : f.action === 'write' ? '+'
        : f.action === 'delete' ? '\u2717'
        : f.action === 'move' ? '\u2192'
        : '\u25C7';
      html += '<div class="wilson-file-item" data-idx="' + i + '">' +
              '<span class="wilson-file-icon">' + icon + '</span>' +
              '<span class="wilson-file-name">' + escHtml(f.fileName) + '</span>' +
              '<span class="wilson-file-action ' + f.action + '">' + f.action + '</span>' +
              '<span class="wilson-file-time">' + timeStr + '</span>' +
              '</div>';
    }
    recentListEl.innerHTML = html;
    // 최신(하단)으로 자동 스크롤
    recentListEl.scrollTop = recentListEl.scrollHeight;
  }

  // Event delegation for file clicks
  if (recentListEl) {
    recentListEl.addEventListener('click', function(e) {
      var item = e.target.closest('.wilson-file-item');
      if (!item) return;
      var idx = parseInt(item.dataset.idx, 10);
      var f = recentFiles[idx];
      if (!f) return;

      // Highlight active
      var prev = recentListEl.querySelector('.wilson-file-item.active');
      if (prev) prev.classList.remove('active');
      item.classList.add('active');

      // 삭제된 파일: 코드뷰어에 안내만 표시 (요청 안 함)
      if (f.isDeleted) {
        window.pendingHighlight = null;
        if (window.displayOutput) {
          window.displayOutput({
            name: 'Deleted',
            target: f.fileName,
            output: '(이 파일은 삭제되어 내용을 표시할 수 없습니다)\n\n경로: ' + f.filePath,
            time: f.time,
          });
        }
        return;
      }

      // Reuse existing viewer flow
      if (f.diffData) {
        window.pendingHighlight = f.diffData;
        window.displayDiff(f.diffData);
      } else {
        window.pendingHighlight = null;
      }
      window.fileCache.delete(f.filePath);
      window.requestFileContent(f.filePath);
    });
  }

  // Handle file_diff SSE event
  function onFileDiff(data) {
    if (!data || !data.filePath) return;
    trackFile({
      filePath: data.filePath,
      target: data.fileName,
      name: 'Edit',
      type: 'tool_done',
      diff: data.diff,
      time: data.time
    });
  }

  // ─── Batch Loading Flag ─────────────────────────────
  function startBatch() { isBatchLoading = true; }
  function endBatch() {
    isBatchLoading = false;
    renderRecentFiles();
  }

  // ─── Panel Toggles ──────────────────────────────────
  var TOGGLE_MAP = {
    wilson: ['.wilson-character'],
    file: ['.wilson-recent'],
    feed: ['.activity-panel', '.resize-handle'],
    diff: ['.code-viewer', '.diff-panel']
  };

  function initToggles() {
    var toggleState = {};
    try {
      var saved = localStorage.getItem('panel-toggles');
      if (saved) toggleState = JSON.parse(saved);
    } catch (e) {}

    var buttons = document.querySelectorAll('.panel-toggle');
    for (var i = 0; i < buttons.length; i++) {
      (function(btn) {
        var key = btn.dataset.panel;
        // Restore saved state
        if (toggleState[key] === false) {
          btn.classList.remove('active');
          applyToggle(key, false);
        }
        btn.setAttribute('aria-pressed', btn.classList.contains('active'));
        btn.addEventListener('click', function() {
          var isActive = btn.classList.toggle('active');
          btn.setAttribute('aria-pressed', isActive);
          applyToggle(key, isActive);
          saveToggleState();
        });
      })(buttons[i]);
    }
  }

  function applyToggle(key, visible) {
    var selectors = TOGGLE_MAP[key];
    if (!selectors) return;
    for (var i = 0; i < selectors.length; i++) {
      var els = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < els.length; j++) {
        if (visible) {
          els[j].classList.remove('panel-hidden');
        } else {
          els[j].classList.add('panel-hidden');
        }
      }
    }
    // Wilson 캐릭터 재표시 시 애니메이션 재개
    if (key === 'wilson' && visible && svgWrap && !animFrame) {
      animate(currentState);
    }
  }

  function saveToggleState() {
    var state = {};
    var buttons = document.querySelectorAll('.panel-toggle');
    for (var i = 0; i < buttons.length; i++) {
      state[buttons[i].dataset.panel] = buttons[i].classList.contains('active');
    }
    try { localStorage.setItem('panel-toggles', JSON.stringify(state)); } catch (e) {}
  }

  // ─── Utility ─────────────────────────────────────────
  function escHtml(str) {
    if (window.escapeHtml) return window.escapeHtml(str);
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ─── Theme Switcher ──────────────────────────────────
  var THEMES = ['beige', 'white', 'dark'];
  var THEME_LABELS = { beige: 'Beige', white: 'White', dark: 'Dark' };

  function applyTheme(name) {
    if (name === 'beige') {
      document.body.removeAttribute('data-theme');
    } else {
      document.body.setAttribute('data-theme', name);
    }
    var btn = document.getElementById('theme-switch');
    if (btn) btn.textContent = THEME_LABELS[name] || 'Beige';
    try { localStorage.setItem('wilson-theme', name); } catch (e) {}
  }

  function initTheme() {
    var saved = 'beige';
    try { saved = localStorage.getItem('wilson-theme') || 'beige'; } catch (e) {}
    if (THEMES.indexOf(saved) === -1) saved = 'beige';
    applyTheme(saved);

    var btn = document.getElementById('theme-switch');
    if (btn) {
      btn.addEventListener('click', function() {
        var curr = localStorage.getItem('wilson-theme') || 'beige';
        var next = THEMES[(THEMES.indexOf(curr) + 1) % THEMES.length];
        applyTheme(next);
      });
    }
  }

  // ─── Init ────────────────────────────────────────────
  resetTimers();
  initToggles();
  initTheme();

  // ─── Public API ──────────────────────────────────────
  window.wilson = {
    onEvent: onEvent,
    onFileDiff: onFileDiff,
    startBatch: startBatch,
    endBatch: endBatch
  };
})();
