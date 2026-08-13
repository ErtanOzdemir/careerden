(function () {
  var requestId = document.currentScript.getAttribute("data-request-id");
  window.PagedConfig = {
    after: function (flow) {
      parent.postMessage(
        { type: "pagedjs-preview-rendered", requestId: requestId, total: flow.total },
        "*",
      );
    },
  };
})();
