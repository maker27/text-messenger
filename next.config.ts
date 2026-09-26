import type { NextConfig } from 'next';
import { z } from 'zod';

const BASE_PATH_PATTERN = /^(\/[a-z0-9-]+)*$/;
const EDGE_SLASH_PATTERN = /^\/|\/$/g;

const basePath = z
  .string()
  .transform((value) => {
    const path = value.replace(EDGE_SLASH_PATTERN, '');

    return path === '' ? '' : `/${path}`;
  })
  .pipe(z.string().regex(BASE_PATH_PATTERN, 'BASE_PATH must look like /text-messenger'))
  .optional()
  .parse(process.env.BASE_PATH);

const nextConfig: NextConfig = {
  basePath,
  output: 'standalone',
  reactCompiler: true,
};

export default nextConfig;
