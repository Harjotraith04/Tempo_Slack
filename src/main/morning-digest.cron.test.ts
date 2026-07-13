import { describe, expect, it, vi } from "vitest";

const { listInstalledUsersMock, getUserTokenMock, respondMock } = vi.hoisted(() => ({
  listInstalledUsersMock: vi.fn(),
  getUserTokenMock: vi.fn(),
  respondMock: vi.fn(),
}));

// The cron now reads prefs too — it has to, in order to honour the user's consent
// scope (which channels Tempo may watch, who it must ignore). It previously built
// its context without them, which is exactly how the unattended surface ended up
// DMing people content from channels they had explicitly de-selected.
vi.mock("../platform/persistence/index.js", () => ({
  getStore: () => ({
    tokens: { list: listInstalledUsersMock, get: getUserTokenMock },
    prefs: { get: async () => undefined },
  }),
}));

vi.mock("../application/orchestrator.js", () => ({
  respond: respondMock,
}));

const { default: handler } = await import("../../api/cron/morning-digest.js");

function fakeReqRes() {
  const req: any = { headers: {} };
  const res: any = {
    statusCode: 0,
    body: undefined as string | undefined,
    end(data?: any) {
      this.body = data;
    },
  };
  return { req, res };
}

describe("morning-digest cron", () => {
  it("isolates per-user failures: one bad user doesn't block the other or 500 the run", async () => {
    listInstalledUsersMock.mockReturnValue([
      { userId: "U1", teamId: "T1", installedAt: 1 },
      { userId: "U2", teamId: "T1", installedAt: 2 },
    ]);
    getUserTokenMock.mockImplementation((id: string) => `tok-${id}`);
    respondMock.mockImplementation(async (ctx: any) => {
      if (ctx.subjectUserId === "U2") throw new Error("boom: invalid token");
      return { intent: "triage", text: "ok", blocks: [], speech: "ok" };
    });

    const { req, res } = fakeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual({ ok: true, users: 2, succeeded: 1, failed: 1 });
  });

  it("falls back to zero targets (and a clean 200) when nothing is installed and no demo token is configured", async () => {
    listInstalledUsersMock.mockReturnValue([]);
    respondMock.mockClear();

    const { req, res } = fakeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.users).toBe(0);
    expect(respondMock).not.toHaveBeenCalled();
  });
});
