import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const RouterContext = createContext(null);
const ParamsContext = createContext({});

function currentLocation() {
  return {
    pathname: window.location.pathname || "/",
    search: window.location.search,
    hash: window.location.hash,
    state: window.history.state
  };
}

function internalTarget(to) {
  const url = new URL(String(to || "/"), window.location.origin);
  if (url.origin !== window.location.origin) {
    throw new Error("External navigation is not allowed through the HMS router.");
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function BrowserRouter({ children }) {
  const [location, setLocation] = useState(currentLocation);

  useEffect(() => {
    const handlePopState = () => setLocation(currentLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((to, options = {}) => {
    if (typeof to === "number") {
      window.history.go(to);
      return;
    }

    const target = internalTarget(to);
    const method = options.replace ? "replaceState" : "pushState";
    window.history[method](options.state ?? null, "", target);
    setLocation(currentLocation());
  }, []);

  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

function useRouter() {
  const router = useContext(RouterContext);
  if (!router) throw new Error("Router components must be rendered inside BrowserRouter.");
  return router;
}

export function useLocation() {
  return useRouter().location;
}

export function useNavigate() {
  return useRouter().navigate;
}

export function useParams() {
  return useContext(ParamsContext);
}

function matchPath(pattern, pathname) {
  if (pattern === "*") return { params: {} };
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index];
    const actual = pathParts[index];
    if (expected.startsWith(":")) {
      try {
        params[expected.slice(1)] = decodeURIComponent(actual);
      } catch {
        return null;
      }
    } else if (expected !== actual) {
      return null;
    }
  }
  return { params };
}

export function Route() {
  return null;
}

export function Routes({ children }) {
  const { pathname } = useLocation();
  const routes = React.Children.toArray(children);
  let fallback = null;

  for (const route of routes) {
    if (!React.isValidElement(route)) continue;
    if (route.props.path === "*") {
      fallback = route;
      continue;
    }
    const match = matchPath(route.props.path, pathname);
    if (match) {
      return <ParamsContext.Provider value={match.params}>{route.props.element}</ParamsContext.Provider>;
    }
  }

  return fallback?.props.element || null;
}

export function Navigate({ to, replace = false, state = null }) {
  const navigate = useNavigate();
  useEffect(() => navigate(to, { replace, state }), [navigate, replace, state, to]);
  return null;
}

export function Link({ to, onClick, target, children, ...props }) {
  const navigate = useNavigate();
  const href = internalTarget(to);
  const handleClick = (event) => {
    onClick?.(event);
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || (target && target !== "_self")
    ) return;
    event.preventDefault();
    navigate(href);
  };
  return <a {...props} href={href} target={target} onClick={handleClick}>{children}</a>;
}

export function NavLink({ to, className, children, ...props }) {
  const { pathname } = useLocation();
  const href = internalTarget(to);
  const targetPath = new URL(href, window.location.origin).pathname;
  const isActive = pathname === targetPath || (targetPath !== "/" && pathname.startsWith(`${targetPath}/`));
  const resolvedClassName = typeof className === "function" ? className({ isActive }) : className;
  const resolvedChildren = typeof children === "function" ? children({ isActive }) : children;
  return <Link {...props} to={href} className={resolvedClassName}>{resolvedChildren}</Link>;
}
