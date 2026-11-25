import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ExternalLink, Loader2, Phone, RefreshCw, Send, ShieldAlert, Unplug } from "lucide-react";
import { toast } from "sonner";
import {
  connectProvider, disconnectProvider, getMessagingStatus, listProviderNumbers,
  selectProviderNumber, sendTestMessage, updateWhatsAppSettings,
  type MessagingStatus, type ProviderNumber,
} from "@/lib/messaging.functions";

export function PhoneNumberSetup() {
  const loadStatusFn = useServerFn(getMessagingStatus);
  const connectFn = useServerFn(connectProvider);
  const listNumbersFn = useServerFn(listProviderNumbers);
  const selectNumberFn = useServerFn(selectProviderNumber);
  const saveWaFn = useServerFn(updateWhatsAppSettings);
  const sendTestFn = useServerFn(sendTestMessage);
  const disconnectFn = useServerFn(disconnectProvider);

  const [status, setStatus] = useState<MessagingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sid, setSid] = useState("");
  const [token, setToken] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [numbers, setNumbers] = useState<ProviderNumber[]>([]);
  const [pickingNumber, setPickingNumber] = useState(false);
  const [loadingNums, setLoadingNums] = useState(false);
  const [waEnabled, setWaEnabled] = useState(false);
  const [waNumber, setWaNumber] = useState("");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshStatus() {
    try {
      const s = await loadStatusFn();
      setStatus(s);
      setWaEnabled(s.whatsappEnabled);
      setWaNumber(s.whatsappNumber ?? "");
      if (s.connected && !s.fromNumber) fetchNumbers();
    } catch (e: any) {
      toast.error(e.message || "Could not load phone settings");
    } finally {
      setLoading(false);
    }
  }

  async function fetchNumbers() {
    setLoadingNums(true);
    try {
      const res = await listNumbersFn();
      setNumbers(res.numbers);
    } catch (e: any) {
      toast.error(e.message || "Could not load Twilio numbers");
    } finally {
      setLoadingNums(false);
    }
  }

  useEffect(() => { refreshStatus(); }, []);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!sid.trim() || !token.trim()) return toast.error("Enter both Account SID and Auth Token.");
    setBusy(true);
    try {
      const res = await connectFn({ data: { accountSid: sid.trim(), authToken: token.trim() } });
      toast.success(`Connected as ${res.accountName}`);
      setToken("");
      setPickingNumber(true);
      await refreshStatus();
      await fetchNumbers();
    } catch (err: any) {
      toast.error(err.message || "Connection failed");
    } finally {
      setBusy(false);
    }
  }

  async function handlePickNumber(num: ProviderNumber) {
    setBusy(true);
    try {
      const res = await selectNumberFn({
        data: { phoneNumber: num.phoneNumber, phoneNumberSid: num.sid, origin: window.location.origin },
      });
      if (res.webhookWarning) toast.info(res.webhookWarning);
      else toast.success(`${res.fromNumber} is ready for texts and replies`);
      setPickingNumber(false);
      await refreshStatus();
    } catch (err: any) {
      toast.error(err.message || "Could not save number");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveWhatsApp() {
    setBusy(true);
    try {
      await saveWaFn({ data: { enabled: waEnabled, whatsappNumber: waNumber.trim() } });
      toast.success("WhatsApp settings saved");
      await refreshStatus();
    } catch (err: any) {
      toast.error(err.message || "Could not save WhatsApp settings");
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    if (!testTo.trim()) return toast.error("Enter a phone number to text.");
    setBusy(true);
    try {
      await sendTestFn({ data: { to: testTo.trim(), channel: "sms" } });
      toast.success("Test text sent!");
      setTestTo("");
    } catch (err: any) {
      toast.error(err.message || "Test text failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect this Twilio account? Messages will stop sending until you connect a number again.")) return;
    setBusy(true);
    try {
      await disconnectFn();
      toast.success("Phone provider disconnected");
      setNumbers([]);
      setPickingNumber(false);
      setSid("");
      setToken("");
      await refreshStatus();
    } catch (err: any) {
      toast.error(err.message || "Could not disconnect");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading phone settings…</p>;

  // Step 1: Connect Twilio
  if (!status?.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5" /> Connect Phone Number</CardTitle>
          <CardDescription>Step 1 of 2 — Connect your Twilio account so your team can send and receive texts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleConnect} className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="twilio-sid">Account SID</Label>
              <Input id="twilio-sid" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" value={sid} onChange={(e) => setSid(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="twilio-token">Auth Token</Label>
              <Input id="twilio-token" type="password" placeholder="Paste your Auth Token" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Connect
              </Button>
              <Button type="button" variant="link" className="px-0 h-auto text-sm" onClick={() => setShowGuide((v) => !v)}>
                {showGuide ? "Hide guide" : "Where do I find these?"}
              </Button>
            </div>
          </form>
          {showGuide && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1.5 max-w-md">
              <p className="font-medium">Find your Account SID &amp; Auth Token in 1 minute:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Open your Twilio Console and sign in (or create a free account).</li>
                <li>On the home dashboard, scroll to <strong>Account Info</strong>.</li>
                <li>Copy <strong>Account SID</strong> and <strong>Auth Token</strong> and paste them above.</li>
              </ol>
              <a href="https://console.twilio.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline pt-1">
                Open Twilio Console <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Step 2: Pick a number
  if (!status.fromNumber || pickingNumber) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle>Pick a Phone Number</CardTitle>
              <CardDescription>Connected as <strong>{status.accountName}</strong>. Choose which number sends and receives texts.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {status.fromNumber && <Button variant="ghost" size="sm" onClick={() => setPickingNumber(false)}>Cancel</Button>}
              <Button variant="outline" size="sm" onClick={fetchNumbers} disabled={loadingNums}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${loadingNums ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingNums ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading your Twilio numbers…</p>
          ) : numbers.length === 0 ? (
            <div className="rounded-md border p-4 space-y-3">
              <p className="text-sm">No phone numbers found on this Twilio account yet.</p>
              <div className="flex items-center gap-2 flex-wrap">
                <a href="https://console.twilio.com/us1/develop/phone-numbers/manage/search" target="_blank" rel="noreferrer">
                  <Button size="sm">Buy a number <ExternalLink className="h-3.5 w-3.5 ml-1.5" /></Button>
                </a>
                <Button variant="outline" size="sm" onClick={fetchNumbers}>I bought one — Refresh</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {numbers.map((n) => (
                <div key={n.sid} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <div className="font-medium">{n.phoneNumber}</div>
                    {n.friendlyName !== n.phoneNumber && <div className="text-xs text-muted-foreground truncate">{n.friendlyName}</div>}
                  </div>
                  <Button size="sm" disabled={busy || !n.smsCapable} onClick={() => handlePickNumber(n)}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : n.phoneNumber === status.fromNumber ? "Selected" : "Use this number"}
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="pt-2 border-t flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Incoming texts are set up automatically when you pick a number.</span>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={handleDisconnect} disabled={busy}>Disconnect</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 3: Connected status & controls
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" /> Phone Number Connected
              </CardTitle>
              <CardDescription>Account: <strong>{status.accountName}</strong> ({status.accountSid}) · Token: ••••••••</CardDescription>
            </div>
            <Badge variant="secondary">Twilio</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap rounded-md border p-3">
            <div className="space-y-1">
              <div className="text-lg font-semibold">{status.fromNumber}</div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">SMS on</Badge>
                <Badge variant="outline">{status.webhookSet ? "Incoming replies on" : "Incoming replies pending"}</Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setPickingNumber(true); fetchNumbers(); }}>Change number</Button>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="test-sms">Send a test text</Label>
            <div className="flex gap-2 max-w-md">
              <Input id="test-sms" placeholder="+1 555 123 4567" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              <Button onClick={handleTest} disabled={busy || !testTo.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />} Send test
              </Button>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-sm">WhatsApp</div>
                <p className="text-xs text-muted-foreground">Optional — use a separate WhatsApp-approved Twilio sender number.</p>
              </div>
              <Switch checked={waEnabled} onCheckedChange={setWaEnabled} />
            </div>
            {waEnabled && (
              <div className="flex gap-2 max-w-md">
                <Input placeholder="WhatsApp sender number (+1…)" value={waNumber} onChange={(e) => setWaNumber(e.target.value)} />
                <Button variant="outline" onClick={handleSaveWhatsApp} disabled={busy}>Save</Button>
              </div>
            )}
            {!waEnabled && status.whatsappEnabled && (
              <Button variant="outline" size="sm" onClick={handleSaveWhatsApp} disabled={busy}>Save WhatsApp off</Button>
            )}
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Safety tip: In Twilio Console, turn on <strong>SMS Pumping Protection</strong> and limit <strong>SMS Geo Permissions</strong> to the countries you text so fake traffic cannot run up your bill.
            </span>
          </div>

          <div className="border-t pt-4">
            <Button variant="outline" size="sm" className="text-destructive" onClick={handleDisconnect} disabled={busy}>
              <Unplug className="h-4 w-4 mr-1.5" /> Disconnect Twilio
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}