export interface AuthEmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
}

export interface AuthEmailProvider {
  send(message: AuthEmailMessage): Promise<void>;
}
