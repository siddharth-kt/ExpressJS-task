const express = require("express");
const app = express();
const port = 3000;
var logger = require("morgan");

// logs for development
app.use(logger("dev"));

// parse application/json
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

let configuration = {
  routes: [],
  clients: [],
};
/**
 * SCHEMA
 * configuration = {
 *      routes: [{
 *          sourcePath: string,
 *          destinationUrl: number,
 *      }],
 *      clients: [{
 *          clientId: string,
 *          limit: number,
 *          seconds: number,
 *      }]
 * }
 */
let rateLimitData = {};
/**
 * SCHEMA
 * rateLimitData = [
 *    clientId[string]: {
 *      requestCount: number,
 *      startingTime: Date,
 *    }
 * ]
 */

app.post("/configure", (request, response) => {
  const { routes, clients } = request.body;

  for (var i = 0; i < routes.length; i++) {
    const route = routes[i];
    if (
      "sourcePath" in route &&
      "destinationUrl" in route &&
      typeof route.sourcePath === "string" &&
      typeof route.destinationUrl === "string"
    ) {
      if (route.sourcePath.startsWith("/configure")) {
        // Invalid sourcePath.
        return response.sendStatus(400);
      }
    } else {
      // Invalid route object.
      return response.sendStatus(400);
    }
  }

  for (var j = 0; j < clients.length; j++) {
    const client = clients[j];
    if ("clientId" in client && typeof client.clientId === "string") {
      let defaultValue = 1;

      if (client.limit === undefined) {
        client.limit = defaultValue;
      } else if (typeof client.limit !== "number") {
        // Invalid client object.
        return response.sendStatus(400);
      }
      if (client.seconds === undefined) {
        client.seconds = defaultValue;
      } else if (typeof client.seconds !== "number") {
        // Invalid client object.
        return response.sendStatus(400);
      }
    } else {
      // Invalid client object.
      return response.sendStatus(400);
    }
  }

  configuration = {
    routes,
    clients,
  };

  console.log("configuration", configuration);
  // Configuration Implemented Successfully.
  return response.sendStatus(200);
});

function rateLimitChecker(client) {
  // This function checks if the request made with a particular clientId should be throttled or not.

  if (client.limit === 0) {
    return {
      isValid: false,
    };
  }

  const rateLimitObject = rateLimitData[client.clientId];
  if (rateLimitObject === undefined) {
    rateLimitData[client.clientId] = {
      requestCount: 1,
      startingTime: new Date(),
    };
  } else {
    const timeNow = new Date();
    var diff = timeNow.getTime() - rateLimitObject.startingTime.getTime();
    var diff_seconds = Math.abs(diff / 1000);

    if (diff_seconds > client.seconds) {
      rateLimitData[client.clientId] = {
        requestCount: 1,
        startingTime: new Date(),
      };
    } else if (rateLimitObject.requestCount >= client.limit) {
      return {
        isValid: false,
      };
    } else {
      rateLimitObject.requestCount += 1;
    }
  }

  return {
    isValid: true,
  };
}

app.get("/:name", function (request, response) {
  // since each request is required to have "client-id" header, we will check it first.
  const client_id = request.headers["client-id"];
  if (!client_id) {
    // ClientId not found.
    return response.sendStatus(400);
  }

  if (configuration.clients.length > 0) {
    // since configuration.clients.length is greater than 0, it means rate-limits need to be applied.

    const client = configuration.clients.find((c) => {
      return c.clientId === client_id;
    });

    if (client === undefined) {
      // Invalid clientId.
      return response.sendStatus(403);
    }

    const rateLimitCheckerResponse = rateLimitChecker(client);
    if (rateLimitCheckerResponse.isValid === false) {
      // Limit exceeded.
      return response.sendStatus(429);
    }
  }

  const route = configuration.routes.find((r) => {
    return r.sourcePath === request.path;
  });

  if (route) {
    return response.redirect(302, route.destinationUrl);
  } else {
    // Invalid path.
    return response.sendStatus(404);
  }
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
