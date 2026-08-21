/* eslint-disable */
// @ts-nocheck
// Arquivo gerado para a árvore estática do TanStack Router no frontend SPA Enterprise.

import { Route as rootRouteImport } from './routes/__root'
import { Route as AdminRouteImport } from './routes/admin'
import { Route as CatalogoRouteImport } from './routes/catalogo'
import { Route as IndexRouteImport } from './routes/index'

const AdminRoute = AdminRouteImport.update({
  id: '/admin',
  path: '/admin',
  getParentRoute: () => rootRouteImport,
} as any)
const CatalogoRoute = CatalogoRouteImport.update({
  id: '/catalogo',
  path: '/catalogo',
  getParentRoute: () => rootRouteImport,
} as any)
const IndexRoute = IndexRouteImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRouteImport,
} as any)

export interface FileRoutesByFullPath { '/': typeof IndexRoute; '/admin': typeof AdminRoute; '/catalogo': typeof CatalogoRoute }
export interface FileRoutesByTo { '/': typeof IndexRoute; '/admin': typeof AdminRoute; '/catalogo': typeof CatalogoRoute }
export interface FileRoutesById { __root__: typeof rootRouteImport; '/': typeof IndexRoute; '/admin': typeof AdminRoute; '/catalogo': typeof CatalogoRoute }
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/admin' | '/catalogo'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/admin' | '/catalogo'
  id: '__root__' | '/' | '/admin' | '/catalogo'
  fileRoutesById: FileRoutesById
}
export interface RootRouteChildren { IndexRoute: typeof IndexRoute; AdminRoute: typeof AdminRoute; CatalogoRoute: typeof CatalogoRoute }

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': { id: '/'; path: '/'; fullPath: '/'; preLoaderRoute: typeof IndexRouteImport; parentRoute: typeof rootRouteImport }
    '/admin': { id: '/admin'; path: '/admin'; fullPath: '/admin'; preLoaderRoute: typeof AdminRouteImport; parentRoute: typeof rootRouteImport }
    '/catalogo': { id: '/catalogo'; path: '/catalogo'; fullPath: '/catalogo'; preLoaderRoute: typeof CatalogoRouteImport; parentRoute: typeof rootRouteImport }
  }
}

const rootRouteChildren: RootRouteChildren = { IndexRoute, AdminRoute, CatalogoRoute }
export const routeTree = rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>()
