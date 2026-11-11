import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const apiKey = process.env.GIPHY_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GIPHY API key is missing." },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    const giphyUrl = new URL(
      "https://api.giphy.com/v1/gifs/search"
    );

    giphyUrl.searchParams.set("api_key", apiKey);
    giphyUrl.searchParams.set("q", query);
    giphyUrl.searchParams.set("limit", "20");
    giphyUrl.searchParams.set("rating", "g");

    const response = await fetch(giphyUrl.toString());

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to search GIFs." },
        { status: response.status }
      );
    }

    const data = await response.json();

    const results = data.data.map((gif: any) => ({
      id: gif.id,
      url: gif.images.fixed_height.url,
      preview: gif.images.fixed_height_small.url,
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while searching GIFs." },
      { status: 500 }
    );
  }
}