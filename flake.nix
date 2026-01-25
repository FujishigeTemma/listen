{
  description = "A very basic flake";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      system = "aarch64-darwin";
      pkgs = nixpkgs.legacyPackages.${system};
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        packages = with pkgs; [
          nodejs_24
          nodePackages.pnpm
        ];

        shellHook = ''
          exec zsh -l
          echo "node: $(node --version)"
          echo "pnpm: $(pnpm --version)"
        '';
      };
    };
}
