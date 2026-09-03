(function () {
  var requestId = document.currentScript.getAttribute("data-request-id");
  var highlightTimeout;
  window.PagedConfig = {
    after: function (flow) {
      parent.postMessage(
        { type: "pagedjs-preview-rendered", requestId: requestId, total: flow.total },
        "*",
      );
    },
  };
  window.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== "pagedjs-preview-highlight-field") return;
    var selector;
    try {
      selector = '[data-field-ref="' + CSS.escape(event.data.fieldRef) + '"]';
    } catch (error) {
      return;
    }
    var target = document.querySelector(selector);
    if (!target) return;

    document.querySelectorAll(".pagedjs-field-highlight").forEach(function (element) {
      element.classList.remove("pagedjs-field-highlight");
    });
    target.classList.add("pagedjs-field-highlight");
    clearTimeout(highlightTimeout);
    highlightTimeout = setTimeout(function () {
      target.classList.remove("pagedjs-field-highlight");
    }, 1600);

    // `scrollIntoView()` here only scrolls within this iframe's own document, which never has an
    // internal scrollbar (it's sized to its full content height) — it does not propagate to the
    // host page's actual scrollable ancestor. Report the target's position as a fraction of the
    // total document height instead: since the iframe is never zoomed/scaled internally, this ratio
    // is valid regardless of whatever zoom level the host is displaying it at, and the host can
    // apply it directly to its own (already zoomed) scrollHeight.
    var docHeight = document.documentElement.scrollHeight || 1;
    var rect = target.getBoundingClientRect();
    parent.postMessage(
      {
        type: "pagedjs-preview-scroll-to",
        requestId: requestId,
        topRatio: rect.top / docHeight,
        heightRatio: rect.height / docHeight,
      },
      "*",
    );
  });
})();
