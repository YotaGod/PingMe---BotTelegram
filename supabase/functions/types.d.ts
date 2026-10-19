declare namespace Deno {
  const env: {
    get(name: string): string | undefined;
  };

  function serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void;
}

declare module "npm:@supabase/supabase-js@2" {
  export function createClient(...args: any[]): any;
}
